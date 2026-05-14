# Meme Search v1 Notes

`memes/` has been removed from the tracked live branch so the Pages deploy stays smaller and cleaner.

Local backup:
- `C:\Users\d2rei\My_Site\memes_v1_local_backup`

Normal live workflow now:
- run [update_site.bat](C:/Users/d2rei/My_Site/memes_v2/update_site.bat)

If you ever want to put `v1` live again:
1. Copy `memes_v1_local_backup` back to `memes`
2. Restore the homepage link if you want a `v1` button again
3. Commit and deploy from the repo

Git history note:
- removing `memes/` from the current branch does **not** erase old GitHub history by itself
- `v1` is still recoverable from older commits unless history is rewritten separately
