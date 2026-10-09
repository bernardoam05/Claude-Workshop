package pt.workshop.activity.activity;

import java.util.List;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

// Camada HTTP (o equivalente ao routes/tasks.js). @RestController: os métodos devolvem dados, serializados em JSON.
// @PreAuthorize: AUTORIZAÇÃO por papel. Quem não tem o papel "admin" no Keycloak recebe 403
// (sabemos quem é, mas não pode). Sem token, recebe 401 (não sabemos quem é).
@RestController
@RequestMapping("/api/activity")
@PreAuthorize("hasRole('admin')")
public class ActivityController {

    private final ActivityService activityService;

    public ActivityController(ActivityService activityService) {
        this.activityService = activityService;
    }

    @GetMapping("/summary")
    public ActivityService.Summary summary() {
        return activityService.summary();
    }

    @GetMapping("/recent")
    public List<ActivityService.ActivityView> recent() {
        return activityService.recent();
    }
}
