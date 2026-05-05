package tn.esprit.virtual_event_management.entity;

public enum SupportedLanguage {
    ARABIC("ar", "Arabe / Tunisien"),
    FRENCH("fr", "Français"),
    ENGLISH("en", "Anglais"),
    SPANISH("es", "Espagnol"),
    GERMAN("de", "Allemand"),
    ITALIAN("it", "Italien"),
    AUTO("auto", "Détection automatique");  // ← Whisper détecte seul !

    private final String code;
    private final String label;

    SupportedLanguage(String code, String label) {
        this.code = code;
        this.label = label;
    }

    public String getCode() { return code; }
    public String getLabel() { return label; }
}
