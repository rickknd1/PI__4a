package clubhub.model;

// ❌ SUPPRIMER @Document
// ❌ PAS une entité Mongo

public class User {

    private String id;
    private String name;
    private String email;
    private String role;

    public User() {}

    public User(String id, String name) {
        this.id = id;
        this.name = name;
    }

    // getters/setters
}
