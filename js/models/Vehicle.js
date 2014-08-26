var ko = require('knockout');
var L = require('leaflet');
var config = require('../config');
var utils = require('../utils');
var fs = require('fs');
var vehiclePopupHTML = fs.readFileSync(__dirname + '/../templates/vehicle-popup.html', 'utf8');

// https://github.com/danro/jquery-easing/blob/818a47a97fa5ea25f1e4c8a6121e0bca9407d51a/jquery.easing.js
function easeInOutCubic(t, b, c, d) {
    if ((t/=d/2) < 1) return c/2*t*t*t + b;
    return c/2*((t-=2)*t*t + 2) + b;
}

function animateMarker(marker, i, steps, startLatLng, deltaLatLng) {
    var x = easeInOutCubic(i, startLatLng[0], deltaLatLng[0], steps),
        y = easeInOutCubic(i, startLatLng[1], deltaLatLng[1], steps);

    marker.setLatLng([x, y]);

    if (i < steps) {
        setTimeout(animateMarker.bind(null, marker, i + 1, steps, startLatLng, deltaLatLng), config.MARKER_ANIMATION_REFRESH_RATE);
    }
}

function Vehicle(data) {
    // FIXME: Do these have to be observables? There isn't two way binding.
    this.id = this.vehicleID = Number(data.Vehicleid);
    this.route = data.Route;
    this.directionID = utils.getDirectionID(this.route, data.Direction);
    this.direction = utils.formatDirection(this.route, this.directionID);
    this.updateTime = data.Updatetime;
    this.block = data.Block;
    this.adherance = data.Adherance;
    this.adheranceChange = data.Adhchange;
    this.reliable = data.Reliable;
    this.offRoute = data.Offroute;
    this.stopped = data.Stopped;
    this.inService = data.Inservice;
    this.routeID = data.Routeid;
    this.speed = data.Speed;
    this.heading = data.Heading;

    this.positions = this.parsePositions(data.Positions.Position);
    // 0 = oldest position, -1 = newest position
    // use oldest position so we can animate from there
    this.latlng = this.positions[0];
    this.lat = this.latlng[0];
    this.lng = this.latlng[1];

    this.marker = this.newMarker();
}

Vehicle.prototype = {
    parsePositions: function (positions) {
        if (!Array.isArray(positions)) {
            positions = [positions];
        }
        var parsed = positions.map(function(pos) {
            pos = pos.split(',');
            return [Number(pos[0]), Number(pos[1])];
        });

        // reverse so the positions are in chronological order
        parsed.reverse();

        return parsed;
    },
    update: function(newVehicle) {
        this.id = newVehicle.id;
        this.route = newVehicle.route;
        this.directionID = newVehicle.directionID;
        this.direction = newVehicle.direction;
        this.updateTime = newVehicle.updateTime;
        this.block = newVehicle.block;
        this.adherance = newVehicle.adherance;
        this.adheranceChange = newVehicle.adheranceChange;
        this.reliable = newVehicle.reliable;
        this.offRoute = newVehicle.offRoute;
        this.stopped = newVehicle.stopped;
        this.inService = newVehicle.inService;
        this.routeID = newVehicle.routeID;
        this.speed = newVehicle.speed;
        this.heading = newVehicle.heading;
        this.positions = newVehicle.positions;
        this.latlng = newVehicle.latlng;
        this.lat = newVehicle.lat;
        this.lng = newVehicle.lng;
    },
    animateTo: function(lat, lng, steps) {
        steps = steps || config.DEFAULT_MARKER_ANIMATION_STEPS;
        var deltaLatLng = [lat - this.marker.getLatLng().lat, lng - this.marker.getLatLng().lng];
        animateMarker(this.marker, 0, steps, [this.marker.getLatLng().lat, this.marker.getLatLng().lng], deltaLatLng);
    },
    draw: function(layer) {
        var timeout = 0,
            steps = 50,
            fudge_factor = 10;

        this.marker.addTo(layer);

        this.positions.forEach(function(pos) {
            setTimeout(
                function() {
                    this.animateTo(pos[0], pos[1], steps);
                }.bind(this),
            timeout);

            timeout += (steps * config.MARKER_ANIMATION_REFRESH_RATE) + fudge_factor;
        }.bind(this));
    },
    move: function() {
        this.animateTo(this.lat, this.lng);
    },
    remove: function(layer) {
        layer.removeLayer(this.marker);
    },
    newMarker: function() {
        var marker = L.circleMarker([this.lat, this.lng], {
            color: '#fff',
            weight: 3,
            radius: 15,
            opacity: 1,
            fillOpacity: '0.9',
            fillColor: this.inService === 'Y' ? 'rgb(34,189,252)' : 'rgb(188,188,188)',
            zIndexOffset: config.vehicleZIndex
        });

        marker.bindPopup(this.popupContent());

        return marker;
    },
    popupContent: function() {
        var div = document.createElement('div');
        div.innerHTML = vehiclePopupHTML;
        ko.applyBindings(this, div);
        return div;
    }
};

module.exports = Vehicle;