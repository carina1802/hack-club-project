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
        }
    ];
    stops.forEach(function(stop){
        L.marker(stop.coordinates).addTo(map)
            .bindPopup(stop.name);
    });
    const routeCoordinates=stops.map(function(stop){
        return stop.coordinates;
    });
    L.polyline(routeCoordinates, {
        color:'#23775b',
        weight:5,
    }).addTo(map);
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