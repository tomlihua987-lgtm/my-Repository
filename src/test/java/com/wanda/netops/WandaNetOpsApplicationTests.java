package com.wanda.netops;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class WandaNetOpsApplicationTests {
    @Test
    void javaRuntimeIsSeventeenOrNewer() {
        assertEquals(true, Runtime.version().feature() >= 17);
    }
}
