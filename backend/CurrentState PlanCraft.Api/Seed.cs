using System.Text.Json;

namespace PlanCraft.Api;

public static class Seed
{
    public static void Load(PlanCraftDb db, string seedPath)
    {
        var json = File.ReadAllText(seedPath);
        var model = JsonSerializer.Deserialize<SeedModel>(json, new JsonSerializerOptions { PropertyNameCaseInsensitive = true })!;

        foreach (var t in model.Tasks) t.StartDate = DateTime.SpecifyKind(t.StartDate, DateTimeKind.Utc);
        foreach (var m in model.ProjectMilestones) m.Date = DateTime.SpecifyKind(m.Date, DateTimeKind.Utc);
        foreach (var to in model.TimeOffs) to.Date = DateTime.SpecifyKind(to.Date, DateTimeKind.Utc);
        db.Banks.AddRange(model.Banks);
        db.People.AddRange(model.People);
        db.Projects.AddRange(model.Projects);
        db.Tasks.AddRange(model.Tasks);
        db.SaveChanges();
        db.TaskAssignments.AddRange(model.TaskAssignments);
        db.TaskDependencies.AddRange(model.TaskDependencies);
        db.ProjectMilestones.AddRange(model.ProjectMilestones);
        db.TimeOffs.AddRange(model.TimeOffs);
        db.Holidays.AddRange(model.Holidays);
        db.SaveChanges();
    }

    public class SeedModel
    {
        public List<Person> People { get; set; } = new();
        public List<Bank> Banks { get; set; } = new();
        public List<Project> Projects { get; set; } = new();
        public List<TaskItem> Tasks { get; set; } = new();
        public List<TaskAssignment> TaskAssignments { get; set; } = new();
        public List<TaskDependency> TaskDependencies { get; set; } = new();
        public List<ProjectMilestone> ProjectMilestones { get; set; } = new();
        public List<PersonTimeOff> TimeOffs { get; set; } = new();
        public List<Holiday> Holidays { get; set; } = new();
    }
}
