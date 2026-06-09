package com.pangochain.backend.blockchain;

import org.springframework.context.ApplicationEvent;

public class FabricChaincodEvent extends ApplicationEvent {

    private final String eventName;
    private final String transactionId;
    private final String payloadJson;

    public FabricChaincodEvent(Object source, String eventName, String transactionId, String payloadJson) {
        super(source);
        this.eventName = eventName;
        this.transactionId = transactionId;
        this.payloadJson = payloadJson;
    }

    public String getEventName()     { return eventName; }
    public String getTransactionId() { return transactionId; }
    public String getPayloadJson()   { return payloadJson; }
}
