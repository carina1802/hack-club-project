    const map=L.map('map',{
        zoomControl:false
    }).setView([41.9028, 12.4964], 13);
    L.control.zoom({
        position:'topright'
    }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    const stops=[
        {
            name:"Collosseum",
            coordinates:[41.8902, 12.4922],
            description:"The Colosseum is an ancient amphitheater in Rome, Italy, known for its iconic architecture and historical significance. It was used for gladiatorial contests and public spectacles."
        },
        {
            name:"Trevi Fountain",
            coordinates:[41.9009, 12.4833],
            description:"The Trevi Fountain is a famous Baroque fountain in Rome, Italy, known for its stunning sculptures and the tradition of tossing coins into the water to ensure a return to the city."
        },
        {
            name:"Pantheon",
            coordinates:[41.8986, 12.4769],
            description:"The Pantheon is a former Roman temple and is now a church in Rome, Italy. It is renowned for its massive dome and well-preserved ancient architecture."
        }
    ];
    const markers=[];
    let routeLayer=null;
    stops.forEach(function(stop,index){
        const customIcon=L.divIcon({
            className:`stop-icon-container`,
            html:`<div class="stop-marker"><span>${index+1}</span></div>`,
            iconSize:[30,30],
            iconAnchor:[15,15],
            popupAnchor:[0,-18]
        });
        const marker=L.marker(stop.coordinates,{
            icon:customIcon,
            title:stop.name,
            alt:`Stop ${index+1}: ${stop.name}`
        }).addTo(map);
        marker.bindPopup(`
            <div class="stop-popup">
                <span class="stop-popup-number">STOP ${index+1}</span>
                <h3>${stop.name}</h3>
                <p>${stop.description}</p>
            </div>
        `,{
            maxWidth:240,
            minWidth:180,
            className:'travel-popup'
        });
        markers.push(marker);
    });
    async function drawRoute(){
        const routeCoordinates=stops.map(function(stop){
        return stop.coordinates[1]+","+stop.coordinates[0];
    }).join(";");
    const url="https://router.project-osrm.org/route/v1/driving/"+routeCoordinates+"?overview=full&geometries=geojson";
    try{
        const response=await fetch(url);
        if(!response.ok){
            throw new Error("Routing device request failed");
        }
        const data=await response.json();
        if(data.code !=="Ok"||!data.routes.length){
            throw new Error("No route found");
        }
        const route=data.routes[0];
        if(routeLayer){
            map.removeLayer(routeLayer);
        }
        const routeOutline=L.geoJSON(route.geometry,{
            style:{
                color:'#ffffff',
                weight:9,
                opacity:0.9,
                lineCap:'round',
                lineJoin:'round'
            }
        });
        const routeLine=L.geoJSON(route.geometry,{
            style:{
                color:'#23775b',
                weight:5,
                opacity:1,
                lineCap:'round',
                lineJoin:'round'
            }
        });
        routeLayer=L.featureGroup([
            routeOutline,
            routeLine
        ]).addTo(map);
        const allStops=L.featureGroup([
            routeLayer,
            ...markers
        ]);
        map.fitBounds(allStops.getBounds(),{
            padding:[40,40],
            maxZoom:15
        });
        const distance = (route.distance/1000).toFixed(2);
        const duration = Math.round(route.duration/60);

        console.log("Route distance:"+distance+"km");
        console.log("Estimated driving time:"+duration+"minutes");
    }catch(error){
        console.error("Error fetching route:",error);
    }
    }
    drawRoute();
    const form = document.getElementById('trip-form');
    const summary = document.getElementById('trip-summary');
    form.addEventListener('submit', function(event){
        event.preventDefault();
        const destination = document.getElementById('destination').value;
        const startDate = document.getElementById('startDate').value;
        const endDate = document.getElementById('endDate').value;
        const budget = document.getElementById('budget').value;
        summary.textContent="Trip to "+destination+" from "+startDate+" to "+endDate+" with a budget of $"+budget;
    });