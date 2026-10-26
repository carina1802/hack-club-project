    const map=L.map('map',{
        zoomControl:false
    }).setView([41.9028, 12.4964], 13);
    L.control.zoom({
        position:'topright'
    }).addTo(map);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    let stops=[];
    let foundPlaces=[];
    let markers=[];
    let selectedMarkers=[];
    let routeLayer=null;
    const placeMarkers = L.markerClusterGroup({
        showCoverageOnHover:false,
        spiderfyOnMaxZoom:true,
        maxClusterRadius:50,
        disableclusteringAtZoom:16
    }).addTo(map);
    const categoryLabels={
        attraction: "Tourist attraction",
        museum:"Museum",
        restaurant:"Restaurant",
        cafe:"Café"
    }
    function getPlaceCategory(tags){
        if(tags.tourism==="museum") return "museum";
        if(tags.amenity==="restaurant") return "restaurant";
        if(tags.amenity==="cafe") return "cafe";
        return "attraction";
    }
    function createPlaceIcon(number,selected=false){
        return L.divIcon({
            className:"custom-map-pin",
            html: `
                <div class="map-pin ${selected ? "is-selected" : ""}">
                    <span>${number}</span>
                </div>
            `,
            iconSize:[30,36],
            iconAnchor:[15,32],
            popupAnchor:[0,-30]
        });
    }
    function renderPlaces(places){
        placeMarkers.clearLayers();
        markers=[];
        const placeList=document.getElementById("places-list");
        placeList.replaceChildren();
        places.forEach(function(place,index){
            markers[index]=null;
            const card=document.createElement("div");
            card.className="place-result";
            const checkbox=document.createElement("input");
            checkbox.type="checkbox";
            checkbox.id=`place-${index}`;
            checkbox.value=String(index);
            checkbox.setAttribute(
                "aria-label",
                `Select ${place.name}`
            );
            const label=document.createElement("label");
            label.htmlFor=checkbox.id;
            const name=document.createElement("strong");
            name.textContent=place.name;
            const details=document.createElement("small");
            details.textContent=`${categoryLabels[place.category]} · ` + (place.address||"Address not available");
            label.append(name,details);
            card.append(checkbox,label);
            placeList.appendChild(card);
            checkbox.addEventListener("change", function(){
                if(checkbox.checked){
                    const marker=L.marker(place.coordinates,{
                        icon:createPlaceIcon(index+1,true),
                        title:place.name,
                        alt:place.name
                    });
                    marker.bindPopup(`
                        <div class="stop-popup">
                            <span class="stop-popup-number">
                                ${categoryLabels[place.category]}
                            </span>
                            <h3>${place.name}</h3>
                            <p>${place.address || "Address not available"}</p>
                        </div>
                    `,{
                        maxWidth:240,
                        minWidth:180,
                        className:"travel-popup"
                    });
                    marker.on("click", function(){
                        map.panTo(place.coordinates);
                    });
                    marker.addTo(placeMarkers);
                    markers[index]=marker;
                }else{
                    if(markers[index]){
                        placeMarkers.removeLayer(markers[index]);
                        markers[index]=null;
                    }
                }
            });
        });
    }
    async function fetchOverpassWithRetry(query){
        const endpoints=[
            "https://overpass-api.de/api/interpreter",
            "https://overpass.kumi.systems/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter"
        ];
        let lastError;
        for(const endpoint of endpoints){
            try{
                const controller=new AbortController();
                const timeoutId=setTimeout(()=>controller.abort(),20000);
                try{
                    const response=await fetch(endpoint,{
                        method:"POST",
                        headers:{
                            "Content-Type":
                                "application/x-www-form-urlencoded;charset=UTF-8",
                            "Accept": "application/json"
                        },
                        body: new URLSearchParams({data:query}),
                        signal:controller.signal
                    });
                    if(!response.ok){
                        throw new Error(`HTTP ${response.status}`);
                    }
                    const data=await response.json();
                    if(!Array.isArray(data.elements)){
                        throw new Error("Invalid response from places service");
                    }
                    return data;
                }finally{
                    clearTimeout(timeoutId);
                }
            }catch(error){
                lastError=error;
                console.warn(
                    `Places server failed (${endpoint}):`,
                    error.message
                );
            }
        }throw new Error("All places sedrvers are currently unavailable. Please try again.");
    }
    async function searchPlaces(){
        const destination=document.getElementById("destination").value.trim();
        const status=document.getElementById("places-status");
        if(!destination){
            status.textContent="Please enter a destination";
            return;
        }
        const selectedCategories=Array.from(
            document.querySelectorAll('input[name="category"]:checked')
        ).map(function(checkbox){
            return checkbox.value;
        });
        if(selectedCategories.length===0){
            status.textContent="Select at least one category";
            return;
        }
        status.textContent=`Searching for places in ${destination}...`;
        try{
            const geocodingURL=new URL(
                "https://nominatim.openstreetmap.org/search"
            );
            geocodingURL.search=new URLSearchParams({
                q:destination,
                format: "jsonv2",
                limit:"1"
            }).toString();
            const cityResponse=await fetch(geocodingURL);
            if(!cityResponse.ok){
                throw new Error("Could not search for this city");
            }
            const cityResults=await cityResponse.json();
            if(cityResults.length===0){
                status.textContent="City not found. Check the spelling";
                return;
            }
            const city=cityResults[0];
            const lat=Number(city.lat);
            const lon=Number(city.lon);
            map.setView([lat,lon],13);
            const categoryFilters={
                attraction:'["tourism"="attraction"]',
                museum:'["tourism"="museum"]',
                restaurant:'["amenity"="restaurant"]',
                cafe:'["amenity"="cafe"]'
            };
            const selectedQueries=selectedCategories
                .filter(category=>categoryFilters[category])
                .map(category=>`nwr(around:3500,${lat},${lon})${categoryFilters[category]};`);
            const allElements=[];
            const failedCategories=[];
            if(selectedQueries.length>0){
                const overpassQuery=
                    "[out:json][timeout:20];\n(" +
                    selectedQueries.join("\n") +
                    "\n);\nout center tags 250;";
                try{
                    status.textContent=`Searching ${selectedCategories.length} categories in ${destination}...`;
                    const data=await fetchOverpassWithRetry(overpassQuery);
                    allElements.push(...data.elements);
                }catch(error){
                    console.error("All place-search servers failed:",error);
                    failedCategories.push(...selectedCategories);
                }

            }
            /*const categoryQueries={
                attraction:
                    `nwr(around:2000,${lat},${lon})`+
                    `["tourism"="attraction"];`,
                museum:
                    `nwr(around:2000,${lat},${lon})`+
                    `["tourism"="museum"];`,
                restaurant:
                    `nwr(around:2000,${lat},${lon})` +
                    `["amenity"="restaurant"];`,
                cafe:
                    `nwr(around:2000,${lat},${lon})` +
                    '["amenity"="cafe"];'
            };
            const resultLimitPerCategory=60;
            const allElements=[];
            const failedCategories=[];
            const endpoint="https://maps.mail.ru/osm/tools/overpass/api/interpreter";
            for(const category of selectedCategories){
                const categoryQwery=categoryQueries[category];
                if(!categoryQwery) continue;
                const overpassQuery=
                    `[out:json][timeout:25];\n(` +
                    categoryQwery +
                    `\n);\nout center tags ${resultLimitPerCategory};`;
                try{
                    const data=await fetchOverpassWithRetry(overpassQuery);
                    const categoryElements=data.elements ||[];
                    console.log(`${categoryLabels[category]}:${categoryElements.length} results`);
                    allElements.push(...categoryElements);
                } catch (error){
                    console.error(
                        `Failed to load ${categoryLabels[category]}:`,
                        error.message
                    );
                    failedCategories.push(category);
                }
            }*/
            const uniqueElements=[
                ...new Map(
                    allElements.map(element=>[
                        `${element.type}-${element.id}`,
                        element
                    ])
                ).values()
            ];
            console.log("Total unique elements:",uniqueElements.length);
            foundPlaces=uniqueElements.map(function(element){
                const tags=element.tags || {};
                const latitude = element.lat ?? element.center?.lat;
                const longitude = element.lon ?? element.center?.lon;
                if(latitude===undefined || longitude===undefined){
                    return null;
                }
                const category=getPlaceCategory(tags);
                if(!selectedCategories.includes(category)){
                    return null;
                }
                const name=tags.name || tags.brand;
                if(!name){
                    return null;
                }
                return {
                    id:`${element.type}-${element.id}`,
                    name:name,
                    category:category,
                    coordinates:[
                        Number(latitude),
                        Number(longitude)
                    ],
                    address:[
                        tags["addr:street"],
                        tags["addr:housenumber"],
                        tags["addr:city"]
                    ].filter(Boolean).join(" ")
                };
            }).filter(Boolean);
            if(routeLayer){
                map.removeLayer(routeLayer);
                routeLayer=null;
            }
            stops=[];
            selectedMarkers=[];
            console.log("Places found:", foundPlaces);
            renderPlaces(foundPlaces);
            if(foundPlaces.length>0){
                const categoryCounts={};
                foundPlaces.forEach(function(place){
                    categoryCounts[place.category]=(categoryCounts[place.category]||0)+1;
                });
                const summary=Object.entries(categoryCounts)
                    .map(([category,count])=>{
                        return `${categoryLabels[category]}:${count}`;
                    }).join(" · ");
                status.textContent=failedCategories.length>0
                    ?`Found ${foundPlaces.length} places. Some categories failed to load. ${summary}`
                    : `Found ${foundPlaces.length} places. ${summary}`;
            }else if (failedCategories.length>0){
                status.textContent="The places service is busy. Please try again shortly.";
            }else{
                status.textContent=`No places found near ${destination}. Try another category.`;
            }
        }catch(error){
            console.error(error);
            status.textContent=error.message || "An error occured while searching.";
        }
    }
    document
        .getElementById("search-places")
        .addEventListener("click",searchPlaces);
    /*async function drawRoute(){
        if(stops.length<2){
            document.getElementById("places-status").textContent="Select at least two places to build a route";
            return;
        }
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
                ...selectedMarkers
            ]);
            map.fitBounds(allStops.getBounds(),{
                padding:[30,30],
                maxZoom:14
            });
            const distance = (route.distance/1000).toFixed(2);
            const duration = Math.round(route.duration/60);

            console.log("Route distance:"+distance+"km");
            console.log("Estimated driving time:"+duration+"minutes");
        }catch(error){
            console.error("Error fetching route:",error);
        }
    }*/
    function renderRoutesitinerary(route,optimized){
        const container=document.getElementById("route-itinerary");
        container.replaceChildren();
        const header=document.createElement("div");
        header.className="itinerary-header";
        const title=document.createElement("h3");
        title.textContent="Your itinerary";
        const subtitle=document.createElement("p");
        subtitle.textContent=optimized
            ?"Stops reordered for a shorter driving route"
            :"Stops in your selected order";
        header.append(title,subtitle);
        const stats=document.createElement("div");
        stats.className="itinerary-status";
        const distanceStat=document.createElement("div");
        distanceStat.className="itinerary-stat";
        const distanceLabel=document.createElement("span");
        distanceLabel.textContent="Total distance";
        const distanceValue=document.createElement("strong");
        distanceValue.textContent=`${(route.distance/1000).toFixed(1)} km`;
        distanceStat.append(distanceLabel,distanceValue);
        const timeStat=document.createElement("div");
        timeStat.className="itinerary-stat";
        const timeLabel=document.createElement("span");
        timeLabel.textContent="Estimated driving time";
        const timeValue=document.createElement("strong");
        const totalMinutes=Math.round(route.duration/60);
        timeValue.textContent=totalMinutes<60
            ?`${totalMinutes} min`
            :`${Math.floor(totalMinutes/60)} h ${totalMinutes % 60} min`;
        timeStat.append(timeLabel,timeValue);
        stats.append(distanceStat,timeStat);
        const list=document.createElement("ol");
        list.className="itinerary-stops";
        stops.forEach(function(stop,index){
            const item=document.createElement("li");
            item.className="itinerary-stop";
            const number=document.createElement("span");
            number.className="itinerary-number";
            number.textContent=String(index+1);
            const content=document.createElement("div");
            content.className="itinerary-stop-content";
            const name=document.createElement("strong");
            name.textContent=stop.name;
            const details=document.createElement("small");
            details.textContent=
                `${categoryLabels[stop.category]} · ` +
                (stop.address || "Address not available");
            content.append(name,details);
            const leg=route.legs && route.legs[index];
            const legInfo=document.createElement("span");
            legInfo.className="itinerary-leg";
            if(leg){
                const legDistance=(leg.distance/1000).toFixed(1);
                const legMinutes=Math.round(leg.duration/60);
                legInfo.textContent=index<stops.length-1
                    ?`Next stop · ${legDistance} km · about ${legMinutes} min`
                    :`Final leg · ${legDistance} km · about ${legMinutes} min`;
            }else{
                legInfo.textContent="Final stop";
            }
            content.appendChild(legInfo);
            item.append(number,content);
            list.appendChild(item);
        });
        container.append(header,stats,list);
    }
    async function drawRoute(){
        const status=document.getElementById("places-status");
        if(stops.length<2){
            status.textContent="Select at least two places to build a route";
            return;
        }
        const routeCoordinates=stops.map(function(stop){
            return `${stop.coordinates[1]},${stop.coordinates[0]}`;
        }).join(";");
        let route;
        let optimized=false;
        try{
            try{
                const tripUrl=
                "https://router.project-osrm.org/trip/v1/driving/"+
                routeCoordinates +
                "?roundtrip=false&source=first&destination=last" +
                "&overview=full&geometries=geojson";

                const tripResponse=await fetch(tripUrl);
                if(!tripResponse.ok){
                    throw new Error(`Trip service HTTP ${tripResponse.status}`);
                }
                const tripData=await tripResponse.json();
                if(
                    tripData.code !== "Ok" ||
                    !tripData.trips ||
                    !tripData.trips.length ||
                    !tripData.waypoints
                ){
                    throw new Error("Could not optimize this group order");
                }
                const ordered=tripData.waypoints.map(
                    function(waypoint,originalIndex){
                        return{
                            stop:stops[originalIndex],
                            marker:selectedMarkers[originalIndex],
                            waypointIndex:waypoint.waypoint_index
                        };
                    }
                ).sort(function(a,b){
                    return a.waypointIndex - b.waypointIndex;
                });
                stops = ordered.map(item=>item.stop);
                selectedMarkers=ordered.map(item=>item.marker);
                route=tripData.trips[0];
                optimized=true;
            }catch(optimizationError){
                console.warn(
                    "Stop optimization unavailable; using selected order.",
                    optimizationError
                );
                const routeUrl=
                    "https://router.project-osrm.org/route/v1/driving/" +
                    routeCoordinates +
                    "?overview=full&geometries=geojson";
                const response=await fetch(routeUrl);
                if(!response.ok){
                    throw new Error(`Route service HTTP ${response.status}`);
                }
                const routeData=await response.json();
                if(
                    routeData.code!=="Ok"||
                    !routeData.routes ||
                    !routeData.routes.length
                ){
                    throw new Error("No driving route could be found.");
                }
                route=routeData.routes[0];
            }
            if(routeLayer){
                map.removeLayer(routeLayer);
            }
            const routeOutline=L.geoJSON(route.geometry,{
                style:{
                    color:'#ffffff',
                    weight:9,
                    opacity:0.95,
                    lineCap:"round",
                    lineJoin:"round"
                }
            });
            const routeLine=L.geoJSON(route.geometry,{
                style:{
                    color:"#23775b",
                    weight:5,
                    opacity:1,
                    lineCap:"round",
                    lineJoin:"round"
                }
            });
            routeLayer=L.featureGroup([
                routeOutline,
                routeLine
            ]).addTo(map);
            const allStops=L.featureGroup([
                routeLayer,
                ...selectedMarkers
            ]);
            map.fitBounds(allStops.getBounds(),{
                padding:[35,35],
                maxZoom:15
            });
            renderRoutezitinerary(route,optimized);
            const distance=(route.distance/1000).toFixed(2);
            const duration=Math.round(route.duration/60);
            status.textContent=optimized
                ?"Your driving route is ready. Stop order optimized."
                :"Your driving route is ready in your selected stop order.";
        }catch(error){
            console.error("Error building route:", error);
            status.textContent="Could not build the route. Please try again.";
        }
   }
    document
        .getElementById("build-route")
        .addEventListener("click",function(){
            const selectedIndexes=Array.from(
                document.querySelectorAll('#places-list input[type="checkbox"]:checked')
            ).map(function(checkbox){
                return Number(checkbox.value);
            });
            stops=selectedIndexes.map(function(index){
                return foundPlaces[index];
            });
            selectedMarkers=selectedIndexes.map(function(index){
                return markers[index];
            });
            if(stops.length<2){
                document.getElementById("places-status").textContent="Select at least two places to build a route";
                return;
            }
            drawRoute();
        });
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
    const themeToggle=document.getElementById("theme-toggle");
    const themeIcon=document.getElementById("theme-icon");
    const themeLabel=document.getElementById("theme-label");
    const savedTheme=localStorage.getItem("travel-planner-theme");
    const initialTheme=savedTheme==="dark"?"dark":"light";
    function applyTheme(theme){
        document.body.dataset.theme=theme;
        const isDark = theme === "dark";
        themeIcon.textContent=isDark?"☀️":"🌙";
        themeLabel.textContent=isDark?"Light mode":"Dark mode";
        themeToggle.setAttribute(
            "aria-label",
            isDark?"Switch to light mode":"Switch to dark mode"
        );
        themeToggle.setAttribute(
            "aria-pressed",
            String(isDark)
        );
        localStorage.setItem("travel-planner-theme",theme);
    }
    applyTheme(initialTheme);
    themeToggle.addEventListener("click",function(){
        const currentTheme=document.body.dataset.theme;
        const nextTheme=currentTheme==="dark"?"light":"dark";
        applyTheme(nextTheme);
    });