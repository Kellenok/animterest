# Anima 2B Style Explorer 🎨

Anima 2B Style Explorer shows how the Anima 2B parameter model draws 40,000 artists from the Danbooru dataset.

<p align="center">
  <img src="images/Anima 2B Style Explorer.png" alt="Anima 2B Style Explorer Banner" width="800">
</p>
<p align="center">
  <img src="images/Anima 2B Style Explorer - Favorites Tab.png" alt="Anima 2B Style Explorer - Favorites Tab" width="800">
</p>

## Overview
This tool helps you see how the Anima 2B model interprets an artist style before you generate an image. We generated each preview image with the prompt `1girl, artist_name`.

## Features
- **40,000 Styles:** Browse the artists in a responsive grid.
- **Search and Filter:** Search by artist name or jump to a popularity rank.
- **Sort:** Order the gallery by Name, Works (dataset popularity), Uniqueness, Date, or Random.
- **Favorites:** Save artists to your personal list. The browser saves this list in IndexedDB.
- **Folder Organization:** Group your favorite artists into folders. Use `Ctrl+Click` to select multiple artists. 
- **Similar Artists:** Find artists with a related style.
- **Import and Export:** Backup your favorites to a JSON file. Export a TXT list for your prompts.
- **Grid Layout:** Change the grid from 4 to 10 columns with the slider or number keys (`4`-`0`).

## Navigation and Hotkeys
- **Arrow Keys:** Move the focus across the grid.
- **Double-click / Double-tap:** Add the artist to your favorites.
- **Middle-click:** Open the QuickLook preview.
- **Scroll Wheel:** Switch photos in the QuickLook preview.
- **F:** Add the artist to your favorites.
- **C / Left-click:** Copy the artist name to the clipboard.
- **Enter:** Open the Similar Artists panel.
- **Escape:** Close the active window.

## Offline Usage
You can run this tool locally. The application size is under 5MB because images stream from Hugging Face.
1. Download the ZIP file or clone the repository (`git clone https://github.com/ThetaCursed/Anima-Style-Explorer.git`).
2. Extract the files.
3. Open `index.html` in your web browser.

Note: Images load from the Hugging Face dataset `Kellenok/anima` and require an internet connection. The browser caches the images automatically via a Service Worker.

## Technical Stack
- **Core Model:** Anima 2B
- **Tagging System:** Danbooru
- **Frontend:** HTML5, CSS3, Vanilla JavaScript

## Acknowledgments
- CircleStone Labs for the Anima 2B model.
- Danbooru community for the tags.

## License
This project is an open-source visual guide for educational and artistic reference.
