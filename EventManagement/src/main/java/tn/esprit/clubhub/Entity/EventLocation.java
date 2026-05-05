package tn.esprit.clubhub.Entity;

import com.fasterxml.jackson.core.JsonParser;
import com.fasterxml.jackson.core.JsonToken;
import com.fasterxml.jackson.databind.DeserializationContext;
import com.fasterxml.jackson.databind.JsonDeserializer;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.annotation.JsonDeserialize;

import java.io.IOException;
import java.util.HashMap;
import java.util.Iterator;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Represents the location of an event.
 *
 * <p>Accepts two JSON shapes for resilience with various frontends:</p>
 * <ul>
 *   <li>An object: {@code {"name": "...", "address": "...", "coordinates": {...}}}
 *       (also tolerates the flat shape {@code {"address","latitude","longitude"}})</li>
 *   <li>A bare string: {@code "Salle A"} — automatically wrapped into
 *       {@code {address: "Salle A", coordinates: {latitude: 0, longitude: 0}}}.</li>
 * </ul>
 */
@JsonDeserialize(using = EventLocation.LocationDeserializer.class)
public class EventLocation {
    private String name;
    private String address;
    private Map<String, Double> coordinates;

    public EventLocation() {}

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getAddress() { return address; }
    public void setAddress(String address) { this.address = address; }

    public Map<String, Double> getCoordinates() { return coordinates; }
    public void setCoordinates(Map<String, Double> coordinates) { this.coordinates = coordinates; }

    /**
     * Tolerant deserializer: accepts a plain string OR an object form.
     *
     * <p>When fed a string, it stores it as {@code address} and zeroes
     * coordinates so downstream consumers still see a complete object.</p>
     */
    public static class LocationDeserializer extends JsonDeserializer<EventLocation> {
        @Override
        public EventLocation deserialize(JsonParser p, DeserializationContext ctxt) throws IOException {
            JsonToken token = p.currentToken();
            EventLocation loc = new EventLocation();

            // Case 1: bare string → treat it as the address.
            if (token == JsonToken.VALUE_STRING) {
                String raw = p.getValueAsString();
                loc.setAddress(raw);
                loc.setName(raw);
                Map<String, Double> coords = new LinkedHashMap<>();
                coords.put("latitude", 0.0);
                coords.put("longitude", 0.0);
                loc.setCoordinates(coords);
                return loc;
            }

            // Case 2: null
            if (token == JsonToken.VALUE_NULL) {
                return null;
            }

            // Case 3: object form — read it as a tree to support both
            // {address, latitude, longitude} and {name, address, coordinates}.
            JsonNode node = p.getCodec().readTree(p);
            if (node == null || node.isNull()) return null;

            if (node.hasNonNull("name")) {
                loc.setName(node.get("name").asText());
            }
            if (node.hasNonNull("address")) {
                loc.setAddress(node.get("address").asText());
            }

            Map<String, Double> coords = new LinkedHashMap<>();
            // Nested coordinates {latitude, longitude}
            JsonNode coordsNode = node.get("coordinates");
            if (coordsNode != null && coordsNode.isObject()) {
                Iterator<Map.Entry<String, JsonNode>> fields = coordsNode.fields();
                while (fields.hasNext()) {
                    Map.Entry<String, JsonNode> e = fields.next();
                    if (e.getValue().isNumber()) coords.put(e.getKey(), e.getValue().asDouble());
                }
            }
            // Flat shape: latitude/longitude at the root.
            if (node.has("latitude") && node.get("latitude").isNumber()) {
                coords.put("latitude", node.get("latitude").asDouble());
            }
            if (node.has("longitude") && node.get("longitude").isNumber()) {
                coords.put("longitude", node.get("longitude").asDouble());
            }
            // Default coords if still empty so consumers always get the keys.
            if (coords.isEmpty()) {
                coords.put("latitude", 0.0);
                coords.put("longitude", 0.0);
            }
            loc.setCoordinates(coords);

            // Fallback name from address when missing.
            if (loc.getName() == null && loc.getAddress() != null) {
                loc.setName(loc.getAddress());
            }
            return loc;
        }
    }
}
