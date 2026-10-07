/*
 * Mapas do Rastrear AgriFamiliar.
 * - Com GOOGLE_MAPS_API_KEY configurada: usa o Google Maps exatamente como o original
 *   (Static Maps na página da etiqueta e no caderno; Maps JavaScript nos editores).
 * - Sem chave: usa Leaflet + OpenStreetMap (mapa) e Esri World Imagery (satélite),
 *   que são gratuitos e não exigem cadastro.
 */
(function (window) {
  "use strict";

  var RA = window.RA;
  var maps = (RA.maps = {});

  var LEAFLET_CSS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css";
  var LEAFLET_JS = "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js";
  var ESRI = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
  var ESRI_LABELS = "https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}";
  var OSM = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  var OSM_ATTR = "&copy; OpenStreetMap";
  var ESRI_ATTR = "Imagens &copy; Esri";

  maps.googleKey = function () {
    return (RA.config.GOOGLE_MAPS_API_KEY || "").trim();
  };

  maps.hasGoogle = function () {
    return !!maps.googleKey();
  };

  var leafletPromise = null;
  maps.loadLeaflet = function () {
    if (window.L) return Promise.resolve(window.L);
    if (!leafletPromise) {
      leafletPromise = new Promise(function (resolve, reject) {
        var css = document.createElement("link");
        css.rel = "stylesheet";
        css.href = LEAFLET_CSS;
        document.head.appendChild(css);
        var s = document.createElement("script");
        s.src = LEAFLET_JS;
        s.onload = function () {
          resolve(window.L);
        };
        s.onerror = reject;
        document.head.appendChild(s);
      });
    }
    return leafletPromise;
  };

  var googlePromise = null;
  maps.loadGoogle = function () {
    if (window.google && window.google.maps) return Promise.resolve(window.google);
    if (!googlePromise) {
      googlePromise = new Promise(function (resolve, reject) {
        window.__raGoogleReady = function () {
          resolve(window.google);
        };
        var s = document.createElement("script");
        s.id = "google-maps-sdk";
        s.src =
          "https://maps.googleapis.com/maps/api/js?key=" +
          encodeURIComponent(maps.googleKey()) +
          "&callback=__raGoogleReady&libraries=places&v=quarterly&language=pt-BR&region=BR";
        s.onerror = reject;
        document.body.appendChild(s);
      });
    }
    return googlePromise;
  };

  // Geocodificação (nome de lugar -> coordenadas)
  maps.geocode = function (address) {
    if (!address) return Promise.resolve(null);
    if (maps.hasGoogle()) {
      return maps.loadGoogle().then(function (google) {
        return new Promise(function (resolve) {
          new google.maps.Geocoder().geocode({ address: address }, function (results, status) {
            if (status === google.maps.GeocoderStatus.OK) {
              var l = results[0].geometry.location;
              resolve({ lat: l.lat(), lng: l.lng() });
            } else resolve(null);
          });
        });
      });
    }
    return fetch(
      "https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=" + encodeURIComponent(address)
    )
      .then(function (r) {
        return r.json();
      })
      .then(function (j) {
        return j && j.length ? { lat: +j[0].lat, lng: +j[0].lon } : null;
      })
      .catch(function () {
        return null;
      });
  };

  // ------------------------------------------------------------------ mapa estático da propriedade
  // FarmMixin.get_map_url: centro, zoom 12, 400x400, marcador verde.
  maps.farmMap = function (el, lat, lng, className) {
    if (maps.hasGoogle()) {
      var url =
        "https://maps.googleapis.com/maps/api/staticmap?center=" +
        lat +
        "%2c%20" +
        lng +
        "&zoom=12&size=400x400&markers=color:green|" +
        lat +
        "," +
        lng +
        "&key=" +
        encodeURIComponent(maps.googleKey());
      el.innerHTML = '<img class="' + (className || "") + '" src="' + url + '">';
      return Promise.resolve();
    }
    return maps.loadLeaflet().then(function (L) {
      var box = document.createElement("div");
      box.className = (className || "") + " ra-leaflet-static";
      box.style.width = "400px";
      box.style.maxWidth = "100%";
      box.style.height = "400px";
      el.innerHTML = "";
      el.appendChild(box);
      var map = L.map(box, {
        center: [lat, lng],
        zoom: 12,
        zoomControl: false,
        attributionControl: true,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
        touchZoom: false
      });
      L.tileLayer(OSM, { attribution: OSM_ATTR, maxZoom: 19 }).addTo(map);
      L.circleMarker([lat, lng], { radius: 9, color: "#1e7e34", fillColor: "#28a745", fillOpacity: 1, weight: 2 }).addTo(map);
      setTimeout(function () {
        map.invalidateSize();
      }, 50);
    });
  };

  // ------------------------------------------------------------------ croqui (impressão do caderno)
  // FarmJournalMixin.get_field_map_url: satélite, polígono vermelho, 580x550, escala 2.
  maps.croquiMap = function (el, polygon) {
    if (!polygon || !polygon.length) return Promise.resolve();
    if (maps.hasGoogle()) {
      var lats = polygon.map(function (p) {
          return p.lat;
        }),
        lngs = polygon.map(function (p) {
          return p.lng;
        });
      var extent =
        Math.min.apply(null, lats) + "," + Math.min.apply(null, lngs) + "|" + Math.max.apply(null, lats) + "," + Math.max.apply(null, lngs);
      var path = polygon
        .concat([polygon[0]])
        .map(function (p) {
          return "|" + p.lat + "," + p.lng;
        })
        .join("");
      var url =
        "https://maps.googleapis.com/maps/api/staticmap?visible=" +
        extent +
        "&zoom=19&scale=2&size=580x550&maptype=satellite&path=color:0xFF0000CC|weight:2|fillcolor:0xFF000059" +
        path +
        "&key=" +
        encodeURIComponent(maps.googleKey());
      el.innerHTML = '<img class="farm-field-map-img" src="' + url + '">';
      return Promise.resolve();
    }
    return maps.loadLeaflet().then(function (L) {
      var box = document.createElement("div");
      box.className = "farm-field-map-img";
      box.style.width = "580px";
      box.style.maxWidth = "100%";
      box.style.height = "550px";
      el.innerHTML = "";
      el.appendChild(box);
      var map = L.map(box, { zoomControl: false, dragging: false, scrollWheelZoom: false, doubleClickZoom: false, keyboard: false });
      L.tileLayer(ESRI, { attribution: ESRI_ATTR, maxZoom: 19 }).addTo(map);
      var poly = L.polygon(
        polygon.map(function (p) {
          return [p.lat, p.lng];
        }),
        { color: "#FF0000", opacity: 0.8, weight: 2, fillColor: "#FF0000", fillOpacity: 0.35 }
      ).addTo(map);
      map.fitBounds(poly.getBounds(), { padding: [20, 20] });
      setTimeout(function () {
        map.invalidateSize();
        map.fitBounds(poly.getBounds(), { padding: [20, 20] });
      }, 50);
    });
  };

  // ------------------------------------------------------------------ editor de ponto (localização da propriedade)
  // Usado por core/edit_handlers/select_coordinates_panel.html
  maps.pointEditor = function (container, center, zoom) {
    if (maps.hasGoogle()) {
      return maps.loadGoogle().then(function (google) {
        var map = new google.maps.Map(container, { center: center, zoom: zoom, mapTypeId: "hybrid" });
        var marker = new google.maps.Marker({ position: center, map: map, draggable: true });
        return {
          getPosition: function () {
            return { lat: marker.getPosition().lat(), lng: marker.getPosition().lng() };
          }
        };
      });
    }
    return maps.loadLeaflet().then(function (L) {
      var map = L.map(container).setView([center.lat, center.lng], zoom);
      L.tileLayer(ESRI, { attribution: ESRI_ATTR, maxZoom: 19 }).addTo(map);
      L.tileLayer(ESRI_LABELS, { maxZoom: 19 }).addTo(map);
      var icon = L.divIcon({
        className: "ra-marker",
        html:
          '<svg width="27" height="43" viewBox="0 0 27 43"><path d="M13.5 0C6 0 0 6 0 13.5 0 23.6 13.5 43 13.5 43S27 23.6 27 13.5C27 6 21 0 13.5 0z" fill="#EA4335" stroke="#B31412" stroke-width="1"/><circle cx="13.5" cy="13.5" r="4.6" fill="#7B0E0B"/></svg>',
        iconSize: [27, 43],
        iconAnchor: [13.5, 43]
      });
      var marker = L.marker([center.lat, center.lng], { draggable: true, icon: icon }).addTo(map);
      setTimeout(function () {
        map.invalidateSize();
      }, 100);
      return {
        getPosition: function () {
          var p = marker.getLatLng();
          return { lat: p.lat, lng: p.lng };
        }
      };
    });
  };

  // ------------------------------------------------------------------ editor de polígono (croqui do talhão)
  // Reproduz farm_journals/panels/google_map_polygon_widget.html
  maps.polygonEditor = function (opts) {
    var container = opts.container;
    var onChange = opts.onChange || function () {};
    var api = {};

    if (maps.hasGoogle()) {
      return maps.loadGoogle().then(function (google) {
        var state = { polygon: undefined, listeners: [] };
        var map = new google.maps.Map(container, { center: opts.center, zoom: 15, mapTypeId: "hybrid" });
        if (opts.searchInput) {
          var ac = new google.maps.places.Autocomplete(opts.searchInput);
          google.maps.event.addListener(ac, "place_changed", function () {
            var result = ac.getPlace();
            if (result.geometry) {
              map.setCenter(result.geometry.location);
              map.fitBounds(result.geometry.viewport);
            }
          });
        }
        function coords() {
          var c = [];
          if (state.polygon) {
            state.polygon.getPath().getArray().forEach(function (p) {
              c.push(p.toJSON());
            });
          }
          return c;
        }
        function bounds(cs) {
          var b = new google.maps.LatLngBounds();
          cs.forEach(function (p) {
            b.extend(new google.maps.LatLng(p.lat, p.lng));
          });
          return b;
        }
        api.add = function (pts) {
          if (!pts) {
            var b = map.getBounds(),
              ne = b.getNorthEast(),
              sw = b.getSouthWest();
            pts = defaultSquare(Math.min(ne.lat(), sw.lat()), Math.min(ne.lng(), sw.lng()), Math.max(ne.lat(), sw.lat()), Math.max(ne.lng(), sw.lng()));
          }
          state.polygon = new google.maps.Polygon({
            paths: pts,
            editable: true,
            draggable: true,
            strokeColor: "#FF0000",
            strokeOpacity: 0.8,
            strokeWeight: 2,
            fillColor: "#FF0000",
            fillOpacity: 0.35
          });
          state.polygon.setMap(map);
          state.polygon.getPaths().forEach(function (path) {
            ["set_at", "insert_at", "remove_at", "bounds_changed"].forEach(function (ev) {
              state.listeners.push(
                google.maps.event.addListener(path, ev, function () {
                  onChange(coords());
                })
              );
            });
          });
          onChange(coords());
        };
        api.remove = function () {
          state.listeners.forEach(function (l) {
            l.remove();
          });
          state.listeners = [];
          state.polygon.setMap(null);
          state.polygon = undefined;
          onChange(coords());
        };
        api.center = function () {
          map.fitBounds(bounds(coords()));
        };
        api.hasPolygon = function () {
          return !!state.polygon;
        };
        if (opts.initial && opts.initial.length) {
          map.setCenter(bounds(opts.initial).getCenter());
          api.add(opts.initial);
          map.fitBounds(bounds(opts.initial));
        }
        return api;
      });
    }

    return maps.loadLeaflet().then(function (L) {
      var map = L.map(container).setView([opts.center.lat, opts.center.lng], 15);
      L.tileLayer(ESRI, { attribution: ESRI_ATTR, maxZoom: 19 }).addTo(map);
      L.tileLayer(ESRI_LABELS, { maxZoom: 19 }).addTo(map);
      var poly = null,
        handles = [],
        mids = [];
      var vertexIcon = L.divIcon({ className: "ra-vertex", iconSize: [12, 12] });
      var midIcon = L.divIcon({ className: "ra-vertex ra-vertex-mid", iconSize: [10, 10] });

      function coords() {
        return poly
          ? poly.getLatLngs()[0].map(function (p) {
              return { lat: p.lat, lng: p.lng };
            })
          : [];
      }
      function clearHandles() {
        handles.concat(mids).forEach(function (h) {
          map.removeLayer(h);
        });
        handles = [];
        mids = [];
      }
      function drawHandles() {
        clearHandles();
        var pts = poly.getLatLngs()[0];
        pts.forEach(function (p, i) {
          var h = L.marker(p, { draggable: true, icon: vertexIcon }).addTo(map);
          h.on("drag", function (e) {
            var ll = poly.getLatLngs()[0];
            ll[i] = e.target.getLatLng();
            poly.setLatLngs(ll);
            updateMids();
          });
          h.on("dragend", function () {
            drawHandles();
            onChange(coords());
          });
          handles.push(h);
        });
        pts.forEach(function (p, i) {
          var q = pts[(i + 1) % pts.length];
          var m = L.marker([(p.lat + q.lat) / 2, (p.lng + q.lng) / 2], { draggable: true, icon: midIcon }).addTo(map);
          m.on("dragstart", function () {
            var ll = poly.getLatLngs()[0];
            ll.splice(i + 1, 0, m.getLatLng());
            poly.setLatLngs(ll);
          });
          m.on("drag", function (e) {
            var ll = poly.getLatLngs()[0];
            ll[i + 1] = e.target.getLatLng();
            poly.setLatLngs(ll);
          });
          m.on("dragend", function () {
            drawHandles();
            onChange(coords());
          });
          mids.push(m);
        });
      }
      function updateMids() {
        var pts = poly.getLatLngs()[0];
        mids.forEach(function (m, i) {
          var p = pts[i],
            q = pts[(i + 1) % pts.length];
          if (p && q) m.setLatLng([(p.lat + q.lat) / 2, (p.lng + q.lng) / 2]);
        });
      }
      api.add = function (pts) {
        if (!pts) {
          var b = map.getBounds();
          pts = defaultSquare(b.getSouth(), b.getWest(), b.getNorth(), b.getEast());
        }
        poly = L.polygon(
          pts.map(function (p) {
            return [p.lat, p.lng];
          }),
          { color: "#FF0000", opacity: 0.8, weight: 2, fillColor: "#FF0000", fillOpacity: 0.35 }
        ).addTo(map);
        drawHandles();
        onChange(coords());
      };
      api.remove = function () {
        clearHandles();
        map.removeLayer(poly);
        poly = null;
        onChange(coords());
      };
      api.center = function () {
        if (poly) map.fitBounds(poly.getBounds());
      };
      api.hasPolygon = function () {
        return !!poly;
      };
      api.search = function (text) {
        return maps.geocode(text).then(function (c) {
          if (c) map.setView([c.lat, c.lng], 15);
          return c;
        });
      };
      if (opts.initial && opts.initial.length) {
        api.add(opts.initial);
        map.fitBounds(poly.getBounds());
      }
      setTimeout(function () {
        map.invalidateSize();
        if (poly) map.fitBounds(poly.getBounds());
      }, 150);
      return api;
    });
  };

  // Polígono padrão: 80% da área visível do mapa (mesma regra do original)
  function defaultSquare(minLat, minLng, maxLat, maxLng) {
    var perc = 0.8,
      latDist = maxLat - minLat,
      lngDist = maxLng - minLng;
    return [
      { lat: minLat + (1 - perc) * latDist, lng: minLng + (1 - perc) * lngDist },
      { lat: minLat + perc * latDist, lng: minLng + (1 - perc) * lngDist },
      { lat: minLat + perc * latDist, lng: minLng + perc * lngDist },
      { lat: minLat + (1 - perc) * latDist, lng: minLng + perc * lngDist }
    ];
  }
})(window);
