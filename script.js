// Initialize the map
// const map = L.map('map').setView([42.6839, 0.6121], 8);

document.addEventListener('DOMContentLoaded', function() {
    // Initialize the map
    const map = L.map('map').setView([42.6839, 0.6121], 8);

    // Add a tile layer
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
        maxZoom: 17,
        attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
    }).addTo(map);

    // Resizing functionality
    const separator = document.getElementById('separator');
    const mapContainer = document.getElementById('map-container');
    const infoPanel = document.getElementById('info-panel');
    const container = document.getElementById('container');

    let isResizing = false;
    let startY, startMapHeight;

    const timeOptions = {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Use 24-hour format
    };

    separator.addEventListener('mousedown', function(e) {
        isResizing = true;
        startY = e.clientY;
        startMapHeight = mapContainer.getBoundingClientRect().height;
        e.preventDefault();
        separator.style.backgroundColor = '#999';
    });

    document.addEventListener('mousemove', function(e) {
        if (!isResizing) return;

        const deltaY = e.clientY - startY;
        const newMapHeight = startMapHeight + deltaY;

        const minMapHeight = 100;
        const maxMapHeight = container.clientHeight - 100;

        if (newMapHeight > minMapHeight && newMapHeight < maxMapHeight) {
            mapContainer.style.height = `${newMapHeight}px`;
            map.invalidateSize();
        }
    });

    document.addEventListener('mouseup', function(e) {
        if (isResizing) {
            isResizing = false;
            separator.style.backgroundColor = '#ccc';
        }
    });

    const jsonPath = "data/tracks.json";
    const trackMarkers = [];
    let currentTrackIndex = 0;
    let tracks = [];

    function getExifData(img, callback) {
        EXIF.getData(img, function() {
            const lat = EXIF.getTag(this, 'GPSLatitude');
            const latRef = EXIF.getTag(this, 'GPSLatitudeRef');
            const lon = EXIF.getTag(this, 'GPSLongitude');
            const lonRef = EXIF.getTag(this, 'GPSLongitudeRef');

            if (lat && lon) {
                const latDecimal = convertDMSToDD(lat, latRef);
                const lonDecimal = convertDMSToDD(lon, lonRef);
                callback({ lat: latDecimal, lng: lonDecimal });
            } else {
                console.log('No GPS data found in the image.');
            }
        });
    }

    // Function to get EXIF data from an image
    function getExifDescription(imgElement, callback) {
        EXIF.getData(imgElement, function() {
            let description = EXIF.getTag(this, 'ImageDescription') || ' ';
            let dateTimeOriginal = EXIF.getTag(this, 'DateTimeOriginal') || ' ';

            // Fix encoding issues for the description
            try {
                // Try to decode assuming it's ISO-8859-1 (Latin-1)
                description = decodeURIComponent(escape(description));
            } catch (e) {
                console.error("Error decoding description:", e);
            }

            if (dateTimeOriginal && dateTimeOriginal.trim() !== '') {
            try {
                // EXIF dates are typically in "YYYY:MM:DD HH:MM:SS" format
                const dateParts = dateTimeOriginal.split(' ');
                if (dateParts.length === 2) {
                    const datePart = dateParts[0].replace(/:/g, '/'); // Replace colons with slashes
                    const timePart = dateParts[1].substring(0, 5); // Get only HH:MM

                    // Combine in the desired format: YYYY/MM/DD HH:MM
                    dateTimeOriginal = `${datePart} ${timePart}`;
                    console.log(dateTimeOriginal)
                }
            } catch (e) {
                console.error("Error formatting date:", e);
                // If there's an error, keep the original value
            }
        }
            callback({ description, dateTimeOriginal });
        });
    }

    function convertDMSToDD(coordinates, hemisphere) {
        let dd = coordinates[0] + coordinates[1] / 60 + coordinates[2] / 3600;
        if (hemisphere === 'S' || hemisphere === 'W') {
            dd = -dd;
        }
        return dd;
    }


    // Function to load a GPX track
    function loadTrack(track, index) {
        new L.GPX(track.gpxFile, { 
                async: true,
                marker_options: {
                    startIconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-green.png',
                    endIconUrl: 'https://cdn.rawgit.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png',
                    shadowUrl: 'https://cdn.jsdelivr.net/gh/pointhi/leaflet-color-markers@master/img/marker-shadow.png',
                    iconSize: [12, 20],
                    iconAnchor:   [6, 20]
                },
            polyline_options: {color: track.color}
            }).on('loaded', function(e) {
                const gpx = e.target;
                tracks[index].gpxLayer = gpx; // Store the GPX layer in the track object
                // map.fitBounds(gpx.getBounds());
                
                // Add click event to the GPX layer
                gpx.on('click', function() {
                    updateInfoPanel(track, index);
                    map.fitBounds(gpx.getBounds());
                    currentTrackIndex = index;
            });
        }).addTo(map);
    }

    // custom icon for photos
    var photoIcon = L.icon({
        iconUrl: 'src/components/icons/240px-Icone_appareil_photo.png',

        iconSize:     [24, 24], // size of the icon
        iconAnchor:   [12, 24], // point of the icon which will correspond to marker's location
        popupAnchor:  [0, -26] // point from which the popup should open relative to the iconAnchor
    });

    var flashIcon = L.icon({
        iconUrl: 'src/components/icons/photo_flash.png',

        iconSize:     [32, 32], // size of the icon
        iconAnchor:   [16, 32], // point of the icon which will correspond to marker's location
        popupAnchor:  [0, -26] // point from which the popup should open relative to the iconAnchor
    });

    // Function to add image markers
    function addImageMarkers(images, trackIndex) {
        const markers = [];
        images.forEach((image, index) => {
            const img = new Image();
            img.src = image.url;
            img.onload = function() {
                getExifData(img, function(coords) {
                    console.log('GPS Coordinates:', coords);
                    // Use coords.lat and coords.lng to place a marker on the map
                    const marker = L.marker([coords.lat, coords.lng], {
                        zIndexOffset: 0,
                        icon: photoIcon
                    }).addTo(map);

                    // Store track and image indices on the marker
                    marker.trackIndex = trackIndex;
                    marker.imageIndex = index;

                    // Create a popup but don't bind it automatically
                    const popupContent = `<img src="${image.url}" style="width:100px;">`;
                    const popup = L.popup({ autoClose: false, closeOnClick: false })
                        .setContent(popupContent);

                    marker.bindPopup(popup); // Store the popup on the marker

                    // Add mouseover and mouseout event listeners for hover behavior
                    marker.on('mouseover', function() {
                        this.openPopup();
                    });

                    marker.on('mouseout', function() {
                        this.closePopup();
                    });

                    // Add click event to the marker
                    marker.on('click', function() {
                        currentTrackIndex = this.trackIndex;
                        const track = tracks[currentTrackIndex];
                        updateInfoPanel(track, currentTrackIndex);

                        // Scroll to the clicked image after a short delay to allow the panel to update
                        setTimeout(() => {
                            scrollToImage(this.trackIndex, this.imageIndex);
                        }, 100);
                    });

                    marker.imageIndex = index;
                    markers[index] = marker;
                });
            };
        });
        trackMarkers[trackIndex] = markers;
    }

    // Function to highlight a marker
    function highlightMarker(trackIndex, imageIndex) {
        if (trackMarkers[trackIndex] && trackMarkers[trackIndex][imageIndex]) {
            const marker = trackMarkers[trackIndex][imageIndex];
            marker.setIcon(flashIcon);
            marker.setZIndexOffset(1000);
            // marker.openPopup();
        }
    }

    // Function to reset a marker to its default appearance
    function resetMarker(trackIndex, imageIndex) {
        if (trackMarkers[trackIndex] && trackMarkers[trackIndex][imageIndex]) {
            const marker = trackMarkers[trackIndex][imageIndex];
            marker.setIcon(photoIcon);
            marker.setZIndexOffset(0);
            // marker.closePopup();
        }
    }

    // Function to center the map on a marker
    function centerMarker(trackIndex, imageIndex) {
        if (trackMarkers[trackIndex] && trackMarkers[trackIndex][imageIndex]) {
            const marker = trackMarkers[trackIndex][imageIndex];
            map.setView(marker.getLatLng(), 15);
            // marker.closePopup();
        }
    }

    // Function to scroll to a specific image in the info panel
    function scrollToImage(trackIndex, imageIndex) {
        const imagesContainer = document.getElementById('images-container');
        const imageInfoDivs = imagesContainer.querySelectorAll('.image-info');

        // Find the image info div corresponding to the clicked marker
        const targetDiv = Array.from(imageInfoDivs).find(div => {
            const img = div.querySelector('img');
            return img && parseInt(img.dataset.trackIndex) === trackIndex && parseInt(img.dataset.imageIndex) === imageIndex;
        });

        if (targetDiv) {
            targetDiv.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
    }

    // Function to update the info panel
    function updateInfoPanel(track, trackIndex) {
        document.getElementById('day-title').textContent = track.dayTitle;
        document.getElementById('day-description').textContent = track.dayDescription;
        const imagesContainer = document.getElementById('images-container');
        imagesContainer.innerHTML = ''; // Clear previous images

        // Fit the map to the bounds of the current track
        const currentTrack = tracks[trackIndex];
        if (currentTrack.gpxLayer) {
            map.fitBounds(currentTrack.gpxLayer.getBounds());
        }

        // Remove any existing track info box
        const existingInfoBox = document.querySelector('.track-info-box');
        if (existingInfoBox) {
            existingInfoBox.remove();
        }
        
        // Create and add track info box
        const trackInfoBox = createTrackInfoBox(currentTrack.gpxLayer);
        if (trackInfoBox) {
            imagesContainer.before(trackInfoBox);
        }

        // Hide all markers first
        for (let i = 0; i < trackMarkers.length; i++) {
            if (trackMarkers[i]) {
                for (let j = 0; j < trackMarkers[i].length; j++) {
                    if (trackMarkers[i][j]) {
                        map.removeLayer(trackMarkers[i][j]);
                    }
                }
            }
        }

        // Show only markers for the current track
        if (trackMarkers[trackIndex]) {
            for (let j = 0; j < trackMarkers[trackIndex].length; j++) {
                if (trackMarkers[trackIndex][j]) {
                    map.addLayer(trackMarkers[trackIndex][j]);
                }
            }
        }

        const fragment = document.createDocumentFragment()

        track.images.forEach((image, imageIndex) => {
            const imageInfoDiv = document.createElement('div');
            imageInfoDiv.className = 'image-info';

            const imgElement = new Image();
            imgElement.src = image.url;
            imgElement.alt = `Image ${imageIndex + 1}`;
            imgElement.dataset.trackIndex = trackIndex;
            imgElement.dataset.imageIndex = imageIndex;

            // Add a loading placeholder
            const placeholder = document.createElement('p');
            placeholder.className = 'placeholder';
            placeholder.textContent = 'Loading image...';
            imageInfoDiv.appendChild(placeholder);

            // Store the image element in the imageInfoDiv for later access
            imageInfoDiv.imgElement = imgElement;

            fragment.appendChild(imageInfoDiv);
        });

        imagesContainer.appendChild(fragment);

        // Load images and metadata asynchronously
        track.images.forEach((image, imageIndex) => {
            const imageInfoDiv = imagesContainer.children[imageIndex];
            const imgElement = imageInfoDiv.imgElement;

            imgElement.onload = function() {
                getExifDescription(imgElement, function(metadata) {
                    // Clear placeholder
                    while (imageInfoDiv.firstChild) {
                        imageInfoDiv.removeChild(imageInfoDiv.firstChild);
                    }

                    const imgElementCopy = imgElement.cloneNode(true);

                    const dateTimeElement = document.createElement('p');
                    dateTimeElement.className = 'image-datetime'; // Apply the CSS class
                    dateTimeElement.textContent = `${metadata.dateTimeOriginal}`;

                    const descriptionElement = document.createElement('p');
                    descriptionElement.className = 'image-description'; // Apply the CSS class
                    descriptionElement.textContent = `${metadata.description}`;
                    
                    // Add event listeners to the image copy
                    imgElementCopy.addEventListener('mouseover', function() {
                        const tIndex = parseInt(this.dataset.trackIndex);
                        const iIndex = parseInt(this.dataset.imageIndex);
                        highlightMarker(tIndex, iIndex);
                    });

                    imgElementCopy.addEventListener('mouseout', function() {
                        const tIndex = parseInt(this.dataset.trackIndex);
                        const iIndex = parseInt(this.dataset.imageIndex);
                        resetMarker(tIndex, iIndex);
                    });

                    imgElementCopy.addEventListener('click', function() {
                        const tIndex = parseInt(this.dataset.trackIndex);
                        const iIndex = parseInt(this.dataset.imageIndex);
                        centerMarker(tIndex, iIndex)
                    });

                    imageInfoDiv.appendChild(imgElementCopy);
                    imageInfoDiv.appendChild(dateTimeElement);
                    imageInfoDiv.appendChild(descriptionElement);
                });
            };

            imgElement.onerror = function() {
                // Clear placeholder
                while (imageInfoDiv.firstChild) {
                    imageInfoDiv.removeChild(imageInfoDiv.firstChild);
                }

                const errorMsg = document.createElement('p');
                errorMsg.textContent = 'Error loading image';
                imageInfoDiv.appendChild(errorMsg);
            };

        });

        // Scroll the info panel back to the top
        const infoPanel = document.getElementById('info-panel');
        infoPanel.scrollTop = 0;
    }

    function createTrackInfoBox(gpxLayer) {
        if (!gpxLayer) return null;

        const distance = gpxLayer.get_distance() ? (gpxLayer.get_distance() / 1000).toFixed(2) + ' km' : 'N/A';
        const startTime = gpxLayer.get_start_time() ? new Date(gpxLayer.get_start_time()).toLocaleTimeString(undefined, timeOptions) : 'N/A';
        const endTime = gpxLayer.get_end_time() ? new Date(gpxLayer.get_end_time()).toLocaleTimeString(undefined, timeOptions) : 'N/A';
        const movingTime = gpxLayer.get_moving_time() ? formatDuration(gpxLayer.get_moving_time()) : 'N/A';
        const elevationGain = gpxLayer.get_elevation_gain() ? gpxLayer.get_elevation_gain().toFixed(0) + ' m' : 'N/A';
        const elevationLoss = gpxLayer.get_elevation_loss() ? gpxLayer.get_elevation_loss().toFixed(0) + ' m' : 'N/A';
        const maxElevation = gpxLayer.get_elevation_max() ? gpxLayer.get_elevation_max().toFixed(0) + ' m' : 'N/A';

        // Create track info box element
        const trackInfoBox = document.createElement('div');
        trackInfoBox.className = 'track-info-box';

        // Add info items
        const infoItems = [
            { label: 'Départ', value: startTime },
            { label: 'Arrivée', value: endTime },
            { label: 'Durée de déplacement', value: movingTime },
            { label: 'Distance', value: distance },
            { label: 'Dénivelé positif', value: elevationGain },
            { label: 'Dénivelé négatif', value: elevationLoss },
            { label: 'Altitude max', value: maxElevation }
        ];

        infoItems.forEach(item => {
            const infoItem = document.createElement('div');
            infoItem.className = 'track-info-item';

            const label = document.createElement('div');
            label.className = 'track-info-label';
            label.textContent = item.label;

            const value = document.createElement('div');
            value.className = 'track-info-value';
            value.textContent = item.value;

            infoItem.appendChild(label);
            infoItem.appendChild(value);
            trackInfoBox.appendChild(infoItem);
        });

        return trackInfoBox;
    }

    function formatDuration(milliseconds) {
        const seconds = Math.floor(milliseconds/1000);
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        // const remainingSeconds = Math.floor(seconds % 60);

        return [
            hours.toString().padStart(2, '0'),
            minutes.toString().padStart(2, '0'),
            // remainingSeconds.toString().padStart(2, '0')
        ].join('h');
    }

    function loadAllTracks() {
        tracks.forEach((track, index) => {
            loadTrack(track, index);
            addImageMarkers(track.images, index);
        }).then(() => {
            // Display the first track's info by default
            if (tracks.length > 0) {
                const firstTrack = tracks[currentTrackIndex];
                updateInfoPanel(firstTrack, currentTrackIndex);
            }
        })
    }

    // fetch json data and load all tracks and markers
    fetch(jsonPath)
        .then(response => response.json())
        .then(data => {
            tracks = data.map(track => ({ ...track, gpxLayer: null }));
            loadAllTracks();
        })
        .catch(error => console.error('Error loading tracks:', error));
        
    function showPreviousTrack() {
        if (currentTrackIndex > 0) {
            currentTrackIndex--;
            updateInfoPanel(tracks[currentTrackIndex], currentTrackIndex);
        }
    }

    function showNextTrack() {
        if (currentTrackIndex < tracks.length - 1) {
            currentTrackIndex++;
            updateInfoPanel(tracks[currentTrackIndex], currentTrackIndex);
        }
    }

    // Add event listeners for the navigation buttons
    document.getElementById('prev-button').addEventListener('click', showPreviousTrack);
    document.getElementById('next-button').addEventListener('click', showNextTrack);

    // Handle window resize
    window.addEventListener('resize', function() {
                map.invalidateSize(); // Ensure the map resizes correctly
    });
});
