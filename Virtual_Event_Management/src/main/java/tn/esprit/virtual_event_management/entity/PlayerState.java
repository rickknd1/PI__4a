package tn.esprit.virtual_event_management.entity;

import lombok.Data;

@Data
public class PlayerState {
    private String id;      // ID unique du client (généré côté Angular)
    private String name;    // Pseudo affiché
    private String color;   // Couleur de l'avatar (hex)
    private double x;       // Position X dans la scène 3D
    private double y;       // Position Y
    private double z;       // Position Z
    private double rotY;    // Rotation Y (direction)
}
