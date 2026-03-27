# Icon Conversion Required

The extension requires a PNG icon for VS Code marketplace.

## Steps to create the icon:

1. Convert `resources/airflow.svg` to `resources/airflow.png` (128x128 pixels)

### Using ImageMagick:
```bash
convert resources/airflow.svg -resize 128x128 resources/airflow.png
```

### Using Inkscape:
```bash
inkscape resources/airflow.svg --export-png=resources/airflow.png --export-width=128 --export-height=128
```

### Using rsvg-convert:
```bash
rsvg-convert -w 128 -h 128 resources/airflow.svg -o resources/airflow.png
```

### Using online tool:
1. Go to https://cloudconvert.com/svg-to-png
2. Upload `resources/airflow.svg`
3. Set dimensions to 128x128
4. Download as `airflow.png`
5. Place in `resources/` folder

The icon is already referenced in `package.json` as `"icon": "resources/airflow.png"`
