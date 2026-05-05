package com.clubhub.treasury.exception;

public class TreasuryException extends RuntimeException {
    private final int status;

    public TreasuryException(String message, int status) {
        super(message);
        this.status = status;
    }

    public int getStatus() { return status; }
}
