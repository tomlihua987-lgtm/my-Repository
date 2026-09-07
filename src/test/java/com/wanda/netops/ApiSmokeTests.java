package com.wanda.netops;

import com.wanda.netops.security.AuthService;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.mock.web.MockHttpSession;
import org.springframework.test.web.servlet.MockMvc;

import java.util.LinkedHashMap;
import java.util.Map;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@SpringBootTest
@AutoConfigureMockMvc
class ApiSmokeTests {
    @Autowired MockMvc mvc;

    private MockHttpSession administratorSession() {
        MockHttpSession session = new MockHttpSession();
        Map<String,Object> user = new LinkedHashMap<>();
        user.put("id", 1L); user.put("username", "test-admin"); user.put("role", "管理员");
        user.put("mustChangePassword", false); user.put("enabled", true);
        session.setAttribute(AuthService.SESSION_USER, user);
        return session;
    }

    @Test
    void healthIsPublicButBusinessApisRequireLogin() throws Exception {
        mvc.perform(get("/api/health")).andExpect(status().isOk()).andExpect(jsonPath("$.status").value("UP"));
        mvc.perform(get("/api/resources/stats")).andExpect(status().isUnauthorized());
    }

    @Test
    void migratedReadApisReturnBaselineData() throws Exception {
        MockHttpSession session = administratorSession();
        mvc.perform(get("/api/resources/stats").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.total").value(10750));
        mvc.perform(get("/api/subnets").param("kind","all").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.length()").value(458));
        mvc.perform(get("/api/dashboard").session(session)).andExpect(status().isOk()).andExpect(jsonPath("$.subnets").value(458));
    }
}
