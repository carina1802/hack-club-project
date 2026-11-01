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
    let userLocationMarker=null;
    let userAccuracyCircle=null;
    let locationWatchId=null;
    let currentUserLocation=null;
    let hasSearchedPlaces=false;
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
    function calculateDistance(lat1,lon1,lat2,lon2){
        const earthRadius=6371;
        const toRadians=degrees=>degrees*Math.PI/180;
        const dLat=toRadians(lat2-lat1);
        const dLon=toRadians(lon2-lon1);
        const a=
            Math.sin(dLat/2)**2+
            Math.cos(toRadians(lat1))*
            Math.cos(toRadians(lat2))*
            Math.sin(dLon/2)**2;
        return 2* earthRadius*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
    }
    function startLiveLocation(){
        const status=document.getElementById("places-status");
        if(!navigator.geolocation){
            status.textContent="Your browser does not support location access";
            return;
        }
        status.textContent="Waiting for location permission...";
        locationWatchId=navigator.geolocation.watchPosition(
           function(position){
                const lat=position.coords.latitude;
                const lon=position.coords.longitude;
                const accuracy=position.coords.accuracy;
                const userPosition=[lat,lon];
                currentUserLocation={
                    lat:lat,
                    lon:lon
                };
                if(!userLocationMarker){
                    const userIcon=L.divIcon({
                        className:"user-loction-icon",
                        html:`
                            <div class="user-location-pulse">
                                <div class="user-location-dot"></div>
                            </div>
                        `,
                        iconSize:[24,24],
                        iconAnchor:[12,12]
                    });
                    userLocationMarker=L.marker(userPosition,{
                        icon:userIcon,
                        zIndexOffset:1000,
                        title:"Your current location"
                    }).addTo(map);
                    userLocationMarker.bindPopup("You are here");
                    userAccuracyCircle=L.circle(userPosition,{
                        radius:accuracy,
                        color:"#7167d9",
                        weight:1,
                        fillColor:"#a99ff5",
                        fillOpacity:0.15
                    }).addTo(map);
                    if(!hasSearchedPlaces){
                        map.setView(userPosition,16);
                    }
                }else{
                    userLocationMarker.setLatLng(userPosition);
                    userAccuracyCircle.setLatLng(userPosition);
                    userAccuracyCircle.setRadius(accuracy);
                }
                status.textContent="Your live location is active.";
           },
            function(error){
                if(error.code===1){
                    status.textContent="Location permission denied. You can still use the planner.";
                }else if(error.code===2){
                    status.textContent="Your location is currently unavailable.";
                }else if(error.code===3){
                    status.textContent="Location request timed out. Trying again when possible";
                }
            },
            {
                enableHighAccuracy:true,
                timeout:15000,
                maximumAge:5000
            }
        );
    }
    function centerOnUser(){
        if(currentUserLocation){
            map.flyTo(
                [currentUserLocation.lat, currentUserLocation.lon],
                16,
                {duration:1.2}
            );
            return;
        }
        if(!navigator.geolocation){
            alert("Geolocation is not supported by your browser.");
            return;
        }
        navigator.geolocation.getCurrentPosition(
            function(position){
                const lat=position.coords.latitude;
                const lon=position.coords.longitude;
                currentUserLocation={lat,lon};
                map.flyTo([lat,lon],16,{duration:1.2});
            },
            function(){
                alert("Your location is unavailable.Please check your browser permissions."); 
            },
            {
                enableHighAccuracy:true,
                timeout:15000,
                maximumAge:5000
            }
        );
    }
    const locateControl=L.control({position:"topleft"});
    locateControl.onAdd=function(){
        const button=L.DomUtil.create(
            "button",
            "locate-me-button"
        );
        button.type="button";
        button.innerHTML='<span class="locate-arrow">➤</span>';
        button.title="Center the map on your current location";
        L.DomEvent.disableClickPropagation(button);
        L.DomEvent.on(button,"click",function(event){
            L.DomEvent.preventDefault(event);
            centerOnUser();
        });
        return button;
    };
    locateControl.addTo(map);
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
            const distanceText=Number.isFinite(place.distance)
                ?` · ${place.distance.toFixed(1)} km away`
                : "";
            details.textContent=
                `${categoryLabels[place.category]} · ` +
                (place.address || "Address not available") +
                distanceText;
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
            "https://overpass.private.coffee/api/interpreter",
            "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
            "https://overpass-api.de/api/interpreter"
        ];
        let lastError=null;
        for(const endpoint of endpoints){
            const controller=new AbortController();
            const timeoutId=setTimeout(()=>controller.abort(),22000);
            try{
                 const response=await fetch(endpoint,{
                    method:"POST",
                    headers:{
                        "Content-Type":
                            "application/x-www-form-urlencoded;charset=UTF-8",
                    },
                    body: new URLSearchParams({data:query}),
                    signal:controller.signal
                });
                if(!response.ok){
                    throw new Error(`HTTP ${response.status}`);
                }
                const data=await response.json();
                if(data.remark){
                    throw new Error(data.remark);
                }
                if(!Array.isArray(data.elements)){
                    throw new Error("Inavlid response from places server");
                }
                console.info(`Places loaded successfully from ${endpoint}`);
                return data;
            }catch(error){
                lastError=error;
                console.warn(
                    `Places erver failed:${endpoint}`,
                    error.name==="AbortError"
                        ? "Request timed out"
                        : error.message
                );
            }finally{
                clearTimeout(timeoutId);
            }
        }throw new Error("All places servers failed. Please wait a moment and try again.");
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
            status.textContent="Searching for places...";
            hasSearchedPlaces=true;
            const sortOrigin=currentUserLocation||{
                lat:lat,
                lon:lon
            };
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
                    "[out:json][timeout:25];\n(" +
                    selectedQueries.join("\n") +
                    "\n);\nout center;";
                try{
                    status.textContent=`Searching ${selectedCategories.length} categories in ${destination}...`;
                    const data=await fetchOverpassWithRetry(overpassQuery);
                    allElements.push(...data.elements);
                }catch(error){
                    console.error("All place-search servers failed:",error);
                    status.textContent=
                        "The places service is temporarily unavailable." +
                        "Please try again in a moment."
                    return;
                }

            }           
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
                    address:
                        tags["addr:full"] ||
                        [
                            tags["addr:housenumber"],
                            tags["addr:street"]
                        ].filter(Boolean).join(" ")||
                        [
                            tags["addr:place"],
                            tags["addr:suburb"]||
                                tags["addr:neighbourhood"],
                            tags["addr:city"]||
                                tags["addr:town"]||
                                tags["addr:village"],
                            tags["addr:postcode"]
                        ].filter(Boolean).join(", ")||
                        tags["description"]||
                        ""
                };
            }).filter(Boolean);
            foundPlaces.forEach(function(place){
                place.distance=calculateDistance(
                    sortOrigin.lat,
                    sortOrigin.lon,
                    place.coordinates[0],
                    place.coordinates[1]
                );
            });
            foundPlaces.sort(function(a,b){
                return a.distance - b.distance;
            });
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
    /*function renderRoutesItinerary(route,optimized){
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
        stats.className="itinerary-stats";
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
    function renderTransportOptions(){
        const container=document.getElementById("leg-transport-options");
        container.replaceChildren();
        if(stops.length<2) return;
        const heading = document.createElement("h3");
        heading.textContent = "Choose transport for each section"
        container.appendChild(heading);
        for(let i=0;i<stops.length-1;i++){
            const section=document.createElement("div");
            section.className="transport-section";
            const label=document.createElement("label");
            label.textContent=`${stops[i].name} → ${stops[i+1].name}`;
            const select=document.createElement("select");
            select.className="transport-mode";
            select.dataset.leg=i;
            const walking=document.createElement("option");
            walking.value="walking";
            walking.textContent="Walking";
            const driving=document.createElement("option");
            driving.value="driving";
            driving.textContent="Driving";
            driving.selected=true;
            select.append(walking, driving);
            section.append(label,select);
            container.appendChild(section);
        }
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
                    color:"#7167d9",
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
            renderRoutesItinerary(route,optimized);
            const distance=(route.distance/1000).toFixed(2);
            const duration=Math.round(route.duration/60);
            status.textContent=optimized
                ?"Your driving route is ready. Stop order optimized."
                :"Your driving route is ready in your selected stop order.";
        }catch(error){
            console.error("Error building route:", error);
            status.textContent="Could not build the route. Please try again.";
        }
   }*/
    function renderRoutesItinerary(route){
        const container=document.getElementById("route-itinerary");
        container.replaceChildren();
        const header=document.createElement("div");
        header.className="itinerary-header";
        const title=document.createElement("h3");
        title.textContent="Your itinerary";
        const subtitle=document.createElement("p");
        subtitle.textContent="Stops in your selected order";
        header.append(title,subtitle);
        const stats=document.createElement("div");
        stats.className="itineary-stats";
        const distanceStat=document.createElement("div");
        distanceStat.className="itinerary-stat";
        const distanceLabel=document.createElement("span");
        distanceLabel.textContent="Total distance";
        const distanceValue=document.createElement("strong");
        distanceValue.textContent=`${(route.distance/1000).toFixed(1)} km`;
        distanceStat.append(distanceLabel, distanceValue);
        const timeStat=document.createElement("div");
        timeStat.className="itinerary-stat";
        const timeLabel=document.createElement("span");
        timeLabel.textContent="Estimated total travel time";
        const timeValue=document.createElement("strong");
        const totalMinutes=Math.round(route.duration/60);
        timeValue.textContent=totalMinutes<60
            ?`${totalMinutes} min`
            :`${Math.floor(totalMinutes/60)} h ${totalMinutes%60} min`;
        timeStat.appent(timeLabel,timeValue);
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
            if(route.legs[index]){
                const leg=route.legs[index];
                const legInfo=document.createElement("span");
                legInfo.className="itinerary-leg";
                const legDistance=(leg.distance/1000).toFixed(1);
                const legMinutes=Math.round(leg.duration/60);
                const modeLabel=leg.mode==="walking"
                    ?"Walking"
                    :"Driving";
                legInfo.txtContent=`${modeLabel} · ${legDistance} km · about ${legMinutes} min`;
                content.appendChild(legInfo);
            }else{
                const finalInfo=document.createElement("span");
                finalInfo.className="itinerary-leg";
                finalInfo.textContent="Final destination";
                content.appendChild(finalInfo);
            }
            item.append(number,content);
            list.appendChild(item);
        });
        container.append(header,stats,list);
    }
    function renderTransportOptions(){
        const container=document.getElementById("leg-transport-options");
        container.replaceChildren();
        if(stops.length<2) return;
        const heading=document.createElement("h3");
        heading.textContent="Choose transport for each section";
        container.appendChild(heading);
        for(let i=0;i<stops.length-1;i++){
            const section=document.createElement("div");
            section.className="transport-section";
            const label=document.createElement("label");
            label.textContent=`${stops[i].name} → ${stops[i+1].name}`;
            const select=document.createElement("select");
            select.className="transport-mode";
            select.dataset.leg=i;
            const walking=document.createElement("option");
            walking.value="walking";
            walking.textContent="Walking";
            const driving=document.createElement("option");
            driving.value="driving";
            driving.textContent="Driving";
            driving.selected=true;
            select.append(walking,driving);
            section.append(label,select);
            container.appendChild(section);
        }
        const applyButton=document.createElement("button");
        applyButton.type="button";
        applyButton.id="apply-transport";
        applyButton.className="apply-transport-button";
        applyButton.textContent="Apply transport choices";
        applyButton.addEventListener("click", function(){
            drawRoute();
        });
        container.appendChild(applyButton);
    }
    async function fetchLegRoute(start,end,mode){
        const costing=mode==="walking"
            ?"pedestrian"
            :"auto";
        const requestBody={
            locations:[
                {
                    lat:start.coordinates[0],
                    lon:start.coordinate[1]
                },
                {
                    lat:end.coordinates[0],
                    lon:end.coordinates[1]
                }
            ],
            costing:costing,
            units:"km",
            format:"osrm",
            shape_format:"geojson"
        };
        const response=await fetch(
            "https://valhalla1.openstreetmap.de/route",
            {
                method:"POST",
                headers:{
                    "Content-type":"application/json"
                },
                body:JSON.stringify(requestBody)
            }
        );
        if(!response.ok){
            throw new Error(`${mode} routing service returned HTTP ${response.status}`);
        }
        const data=await response.json();
        if(
            !data.routes||
            !data.routes.length||
            !data.routes[0].geometry||
            !data.routes[0].geometry.coordinates
        ){
            throw new Error(`No ${mode} route could be found.`);
        }
        const route=data.routes[0];
        return{
            mode:mode,
            distance:route.distance*1000,
            duration:route.duration,
            geometry:route.geometry
        };
    }
    async function drawRoute(){
        const status=document.getElementById("places-status");
        const applyButton=document.getElementById("apply-transport");
        if(stops.length<2){
            status.textContent="Select at least two places to build a route";
            return;
        }
        const transportSelections=Array.from(document.querySelectorAll(".transport-mode"));
        if(transportSelections.length!==stops.length-1){
            status.textContent="Please choose transport for every section";
            return;
        }
        const modes=transportSelections.map(function(select){
            return select.value;
        });
        if(applyButton){
            applyButton.disabled=true;
            applyButton.textContent="Calculating route...";
        }
        status.textContent="Calculating your walking and driving routes...";
        try{
            const calculatedLegs=[];
            for(let i=0;i<stops.length-1;i++){
                status.textContent=`Calculating section ${i+1} of ${stops.length-1}...`;
                const leg=await fetchLegRoute(
                    stops[i],
                    stops[i+1],
                    modes[i]
                );
                calculatedLegs.push(leg);
            }
            const totalDistance=calculatedLegs.reduce(
                (total,leg)=>total+leg.distance,
                0
            );
            const totalDuration=calculatedLegs.reduce(
                (total,leg)=>total+leg.duration,
                0
            );
            const routeLayers=[];
            calculatedLegs.forEach(function(leg){
                const routeColor=leg.mode==="walking"
                    ?"#e46b75"
                    :"#7167d9"
                const outline=L.geoJSON(leg.geometry,{
                    style:{
                        color:"#ffffff",
                        weight:8,
                        opacity:0.95,
                        lineCap:"round",
                        lineJoin:"round"
                    }
                });
                const routeLine=L.geoJSON(leg.geometry,{
                    style:{
                        color:routeColor,
                        weight:5,
                        opacity:1,
                        lineCap:"round",
                        lineJoin:"round"
                    }
                });
                routeLayers.push(outline,routeLine);
            });
            if(routeLayer){
                map.removeLayer(routeLayer);
            }
            routeLayer=L.featureGroup(routeLayers).addTo(map);
            const boundsLayers=[
                routeLayer,
                ...selectedMarkers.filter(Boolean)
            ];
            const allStops=L.featureGroup(boundsLayers);
            map.fitBounds(allStops.getBounds(),{
                padding:[35,35],
                maxZoom:15
            });
            const combinedRoute={
                distance:totalDistance,
                duration:totalDuration,
                legs:calculatedLegs
            };
            renderRoutesItinerary(combinedRoute);
            status.textContent="Your mixed transport route is ready";
        }catch(error){
            console.error("Error building route:", error);
            status.textContent=error.message||"Could not build the route. Please try again.";
        }finally{
            if(applyButton){
                applyButton.disabled=false;
                applyButton.textContent="Apply transport choices";
            }
        }
    }
    document
        .getElementById("build-route")
        .addEventListener("click",function(){
            const selectedIndexes=Array.from(
                document.querySelectorAll(
                    '#places-list input[type="checkbox"]:checked'
                )
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
                document.getElementById("places-status").textContent=
                    "Select at least two places to build a route.";
                return;
            }
            if(routeLayer){
                map.removeLayer(routeLayer);
                routeLayer=null;
            }
            document.getElementById("route-itinerary").replaceChildren();
            renderTransportOptions();
            document.getElementById("places-status").textContent="Choose transport for each section, then apply your choices";
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
    startLiveLocation();