    const map=L.map('map').setView([41.9028, 12.4964], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    const stops=[
        {
            name:"Collosseum",
            coordinates:[41.8902, 12.4922]
        },
        {
            name:"Trevi Fountain",
            coordinates:[41.9009, 12.4833]
        },
        {
            name:"Pantheon",
            coordinates:[41.8986, 12.4769]
        }
    ];
    const markers=[];
    let routeLayer=null;
    stops.forEach(function(stop,index){
        const marker=L.marker(stop.coordinates).addTo(map);
        marker.bindPopup("<strong>"+(index+1)+"."+stop.name+"</strong>");
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
        routeLayer=L.geoJSON(route.geometry,{
            style:{
                color:'#23775b',
                weight:5,
                opacity:0.85
            }
        }).addTo(map);
        map.fitBounds(routeLayer.getBounds(),{
            padding:[30,30]
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
        const startDate = document.getElementById('start-date').value;
        const endDate = document.getElementById('end-date').value;
        const budget = document.getElementById('budget').value;
        summary.textContent="Trip to "+destination+" from "+startDate+" to "+endDate+" with a budget of $"+budget;
    });