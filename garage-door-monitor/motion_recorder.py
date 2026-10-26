from __future__ import annotations
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import threading
import time
import uuid

import cv2
import numpy as np

class MotionRecorder:
    def __init__(self, monitor, root=None):
        self.monitor = monitor
        self.root = Path(root or monitor.env.get('RECORDING_DIRECTORY', 'D:/GarageRecordings'))
        self.lock = threading.RLock()
        self.error = 'Starting recorder'
        self.running = False
        self.process = None

    def ffmpeg(self):
        executable = shutil.which('ffmpeg')
        if executable:
            return executable
        sys.path.insert(0, str(Path(__file__).parent / 'vendor'))
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()

    def clips(self):
        with self.lock:
            result = []
            for folder in ('temporary', 'kept'):
                for file in (self.root / folder).glob('*.mp4'):
                    stat = file.stat()
                    result.append(dict(id=file.name, kept=folder == 'kept', timestamp=stat.st_mtime, bytes=stat.st_size))
            return sorted(result, key=lambda item: item['timestamp'], reverse=True)

    def status(self):
        return dict(running=self.running, error=self.error, directory=str(self.root), retentionDays=3, limitGB=20, clips=self.clips())

    def path(self, name):
        if not isinstance(name, str) or Path(name).name != name or not name.endswith('.mp4'):
            raise ValueError('Invalid clip name')
        for folder in ('kept', 'temporary'):
            path = self.root / folder / name
            if path.is_file():
                return path
        raise ValueError('Clip not found')

    def keep(self, name):
        with self.lock:
            source = self.path(name)
            destination = self.root / 'kept' / name
            if source != destination:
                source.replace(destination)
            return {'ok': True}

    def cleanup(self):
        with self.lock:
            files = sorted((self.root / 'temporary').glob('*.mp4'), key=lambda file: file.stat().st_mtime)
            total = sum(file.stat().st_size for file in files)
            for file in files:
                stat = file.stat()
                if stat.st_mtime < time.time() - 3 * 86400 or total > 20 * 1024**3:
                    file.unlink()
                    total -= stat.st_size

    def finish(self, files, executable, buffer):
        if not files:
            return
        name = time.strftime('%Y-%m-%d_%H-%M-%S') + '_' + uuid.uuid4().hex[:6]
        listing = buffer / 'concat.txt'
        listing.write_text(''.join("file '" + file.name + "'\n" for file in files), encoding='utf-8')
        output = self.root / 'temporary' / (name + '.partial')
        completed = subprocess.run([executable, '-hide_banner', '-loglevel', 'quiet', '-f', 'concat', '-safe', '0', '-i', str(listing), '-map', '0:v:0', '-c', 'copy', '-movflags', '+faststart', '-f', 'mp4', str(output)], creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0), timeout=60)
        if completed.returncode:
            output.unlink(missing_ok=True)
            raise RuntimeError('Could not save motion clip')
        output.replace(output.with_suffix('.mp4'))
        self.cleanup()

    def session(self):
        if not self.root.anchor or not Path(self.root.anchor).exists():
            raise RuntimeError('Recording drive is unavailable')
        for folder in ('temporary', 'kept', 'buffer'):
            (self.root / folder).mkdir(parents=True, exist_ok=True)
        buffer = self.root / 'buffer'
        # Only recorder-owned scratch files are removed after a restart.
        for pattern in ('segment-*.ts', 'concat.txt'):
            for file in buffer.glob(pattern):
                file.unlink()
        self.cleanup()
        executable = self.ffmpeg()
        pattern = str(buffer / 'segment-%09d.ts')
        command = [executable, '-hide_banner', '-loglevel', 'quiet', '-rtsp_transport', 'tcp', '-timeout', '10000000', '-i', self.monitor._stream_url().replace('/stream2', '/stream1'), '-map', '0:v:0', '-c:v', 'copy', '-f', 'segment', '-segment_time', '2', '-reset_timestamps', '1', pattern, '-map', '0:v:0', '-vf', 'fps=3,scale=320:180', '-pix_fmt', 'gray', '-f', 'rawvideo', 'pipe:1']
        self.process = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.DEVNULL, creationflags=getattr(subprocess, 'CREATE_NO_WINDOW', 0))
        previous = None
        active_start = None
        last_motion = 0
        started = time.time()
        last_cleanup = 0
        self.running, self.error = True, None
        try:
            while not self.monitor.stop_event.is_set():
                data = self.process.stdout.read(320 * 180)
                if len(data) != 320 * 180:
                    raise RuntimeError('Camera recording feed disconnected')
                frame = cv2.GaussianBlur(np.frombuffer(data, np.uint8).reshape(180, 320), (5, 5), 0)
                now = time.time()
                # Exclude the timestamp strip; require at least 1% of pixels to change.
                moving = previous is not None and np.mean(cv2.absdiff(frame[18:], previous[18:]) > 25) > .01
                previous = frame
                if moving and now - started > 3:
                    if active_start is None:
                        active_start = now - 8  # five seconds plus segment boundary allowance
                    last_motion = now
                files = sorted(buffer.glob('segment-*.ts'))
                closed = files[:-1]  # last file is still being written
                if active_start is not None and (now - last_motion >= 18 or now - active_start >= 300):
                    self.finish([file for file in closed if file.stat().st_mtime >= active_start], executable, buffer)
                    active_start = None
                cutoff = active_start if active_start is not None else now - 12
                for file in closed:
                    if file.stat().st_mtime < cutoff:
                        file.unlink()
                if shutil.disk_usage(self.root).free < 512 * 1024**2:
                    raise RuntimeError('Recording paused: less than 512 MB free on drive')
                if now - last_cleanup > 60:
                    self.cleanup()
                    last_cleanup = now
        finally:
            self.running = False
            self.process.kill()
            self.process.wait(timeout=10)
            self.process.stdout.close()
            if active_start is not None:
                self.finish([file for file in sorted(buffer.glob('segment-*.ts')) if file.stat().st_mtime >= active_start], executable, buffer)

    def worker(self):
        while not self.monitor.stop_event.is_set():
            try:
                self.session()
            except Exception as error:
                self.running = False
                self.error = str(error)
                self.monitor.logger.warning('Motion recorder: %s', self.error)
            self.monitor.stop_event.wait(15)

    def stop(self):
        if self.process and self.process.poll() is None:
            self.process.kill()
