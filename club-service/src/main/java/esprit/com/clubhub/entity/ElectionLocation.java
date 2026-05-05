package esprit.com.clubhub.entity;

public class ElectionLocation {
    private String address;
    private double latitude;
    private double longitude;
    private String placeName;

    public ElectionLocation() {}

    public ElectionLocation(String address, double latitude, double longitude) {
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
    }

    public ElectionLocation(String address, double latitude, double longitude, String placeName) {
        this.address = address;
        this.latitude = latitude;
        this.longitude = longitude;
        this.placeName = placeName;
    }

    public String getAddress() { return address; }
    public double getLatitude() { return latitude; }
    public double getLongitude() { return longitude; }
    public String getPlaceName() { return placeName; }

    public void setAddress(String address) { this.address = address; }
    public void setLatitude(double latitude) { this.latitude = latitude; }
    public void setLongitude(double longitude) { this.longitude = longitude; }
    public void setPlaceName(String placeName) { this.placeName = placeName; }
}
