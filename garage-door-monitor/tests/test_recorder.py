import logging
from pathlib import Path
import sys
import tempfile
import time
import unittest
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from motion_recorder import MotionRecorder

class FakeMonitor:
    env = {}

class RecorderTests(unittest.TestCase):
    def test_expiry_preserves_kept_and_recent_clips(self):
        with tempfile.TemporaryDirectory() as directory:
            recorder = MotionRecorder(FakeMonitor(), directory)
            for folder in ('temporary', 'kept'):
                (Path(directory)/folder).mkdir()
            old = Path(directory)/'temporary'/'old.mp4'
            old.write_bytes(b'old')
            import os
            os.utime(old, (time.time()-4*86400,)*2)
            recent = old.with_name('recent.mp4');recent.write_bytes(b'recent')
            protected = old.with_name('protected.mp4');protected.write_bytes(b'protected')
            os.utime(protected, (time.time()-4*86400,)*2)
            recorder.keep(protected.name)
            recorder.cleanup()
            self.assertFalse(old.exists())
            self.assertTrue(recent.exists())
            self.assertTrue((Path(directory)/'kept'/protected.name).exists())
            recorder.keep(protected.name)  # repeat clicks remain safe
            self.assertEqual(len(recorder.clips()), 2)

    def test_clip_paths_cannot_escape_storage(self):
        with tempfile.TemporaryDirectory() as directory:
            recorder=MotionRecorder(FakeMonitor(),directory)
            for name in ('../secret.mp4', 'C:/secret.mp4', '', None):
                with self.assertRaises(ValueError):
                    recorder.path(name)

if __name__=='__main__':
    unittest.main()
