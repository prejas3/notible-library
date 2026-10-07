# Notible Library

An official, offline-first collection for books, films, series and games. Items are ordinary synced Notible objects; their note body is the description.

## Use

Open **Library** in the sidebar or choose **New library item** from the create menu. Filter the shelf by kind, status or tag and sort by rating or recent changes. Covers selected through the picker are copied into Notible's managed media store, so normal media sync and cleanup rules apply.

## Permissions

- `data.read` / `data.write`: list and create library items.
- `media.read`: render covers pasted elsewhere. Covers picked by Library remain readable through the plugin's own media ownership even when the pasted image setting is off.
- `media.write`: open Notible's image picker and store the chosen cover.
- `workspace.ui`: render the Library view and quick-add dialog.

No network access is requested. Cover files are limited to supported image formats and 20 MB by Core.
