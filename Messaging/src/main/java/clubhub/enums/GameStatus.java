package clubhub.enums;

import com.fasterxml.jackson.annotation.JsonCreator;
import com.fasterxml.jackson.annotation.JsonValue;

public enum GameStatus {
    WAITING, IN_PROGRESS, FINISHED;

    @JsonCreator
    public static GameStatus from(String value) {
        return valueOf(value.toUpperCase());
    }

    @JsonValue
    public String toValue() {
        return this.name();
    }
}