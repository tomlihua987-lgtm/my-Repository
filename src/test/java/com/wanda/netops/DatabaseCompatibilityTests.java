package com.wanda.netops;

import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.jdbc.core.JdbcTemplate;

import static org.junit.jupiter.api.Assertions.assertEquals;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.NONE)
class DatabaseCompatibilityTests {
    @Autowired JdbcTemplate jdbc;

    @Test
    void migratedDatabaseContainsTheExpectedBaseline() {
        assertEquals(10_750L, jdbc.queryForObject("select count(*) from resource_records", Long.class));
        assertEquals(458L, jdbc.queryForObject("select count(*) from subnets", Long.class));
        assertEquals(120_996L, jdbc.queryForObject("select count(*) from addresses", Long.class));
        assertEquals(5L, jdbc.queryForObject("select count(*) from users", Long.class));
    }
}
