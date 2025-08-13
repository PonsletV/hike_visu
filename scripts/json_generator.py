import os
import json
from datetime import datetime, timedelta
from collections import defaultdict
import exifread

def get_image_date(image_path):
    """Extract date from image filename or metadata (simplified version)"""
    # Try to get date from filename pattern (e.g., PXL_20250706_160116781.MP.jpg or DSC07813.jpg in 2025_07_06 folder)
    basename = os.path.basename(image_path)
    dirname = os.path.basename(os.path.dirname(image_path))

    with open(image_path, 'rb') as fh:
        tags = exifread.process_file(fh, stop_tag="EXIF DateTimeOriginal")
        dateTaken = datetime.strptime(str(tags["EXIF DateTimeOriginal"]), "%Y:%m:%d %H:%M:%S")
        return dateTaken

def get_sorted_images(image_dir):
    """Get all images from directory, sorted by date and time"""
    images = []
    for root, _, files in os.walk(image_dir):
        for file in files:
            if file.lower().endswith(('.jpg', '.jpeg', '.png')):
                file_path = os.path.join(root, file)
                images.append(file_path)

    # Sort images by date and filename
    images.sort(key=lambda x: (get_image_date(x), x))
    return images

def group_images_by_day(images):
    """Group images by day based on their date"""
    day_groups = defaultdict(list)

    for image in images:
        date = get_image_date(image)
        date_key = date.strftime('%Y_%m_%d')
        day_groups[date_key].append(image)

    return day_groups

def generate_json(gpx_dir, image_dir, output_file):
    """Generate JSON file with tracks and images"""
    # Get all GPX files
    gpx_files = []
    for file in os.listdir(gpx_dir):
        if file.lower().endswith('.gpx'):
            gpx_files.append(os.path.join(gpx_dir, file))

    # Sort GPX files by name (assuming they're named in order)
    gpx_files.sort()
    print(gpx_files)
    # Get all images and group them by day
    images = get_sorted_images(image_dir)
    day_groups = group_images_by_day(images)

    # Create a mapping from date to day number (J1, J2, etc.)
    date_to_day = {}
    for i, gpx_file in enumerate(gpx_files, start=1):
        date_str = gpx_file.split('/')[-1].split('_')[1][1:]  # Extract date from HRP_J1.gpx -> J1 -> 1
        # This is a simplified approach - you might need to adjust based on your actual GPX filenames
        # For this example, we'll assume the GPX files are named in order (HRP_J1.gpx, HRP_J2.gpx, etc.)
        # and that each GPX file corresponds to one day of images

    # Create the JSON structure
    tracks = []
    colors = [
        "#0000FF", "#FF0000", "#00FF00", "#FF00FF", "#00FFFF", "#FFFF00",
        "#FFA500", "#800080", "#008000", "#808000", "#800000", "#008080"
    ]

    start_date = datetime.strptime("2025/07/06", "%Y/%m/%d")
    
    for i, gpx_file in enumerate(gpx_files):
        day_num = i + 1
        current_date = start_date + timedelta(days=i)
        date_key = current_date.strftime("%Y_%m_%d")  # This is a placeholder - adjust based on your actual dates
        # Find images for this day
        day_images = day_groups.get(date_key, [])

        # Create image objects
        image_objects = []
        for image_path in day_images:
            relative_path = os.path.relpath(image_path, start=os.path.dirname(os.path.abspath(__file__)))
            image_objects.append({"url": relative_path.replace("\\", "/")})

        # Create track object
        track = {
            "gpxFile": os.path.relpath(gpx_file, start=os.path.dirname(os.path.abspath(__file__))).replace("\\", "/"),
            "dayTitle": f"HRP : Jour {day_num}",
            "color": colors[i % len(colors)],
            "dayDescription": "",  # You'll need to add descriptions manually
            "images": image_objects
        }

        tracks.append(track)

    # Write to JSON file
    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(tracks, f, indent=4, ensure_ascii=False)

if __name__ == "__main__":
    # Adjust these paths to match your directory structure
    GPX_DIR = "data/gpx"
    IMAGE_DIR = "data/images"
    OUTPUT_FILE = "tracks.json"

    generate_json(GPX_DIR, IMAGE_DIR, OUTPUT_FILE)
    print(f"JSON file generated: {OUTPUT_FILE}")
