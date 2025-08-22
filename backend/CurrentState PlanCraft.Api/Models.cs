using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Reflection.Emit;
using System.Text.Json.Serialization;

namespace PlanCraft.Api;

public class PlanCraftDb : DbContext
{
    public PlanCraftDb(DbContextOptions<PlanCraftDb> options) : base(options) { }
    public DbSet<Person> People => Set<Person>();
    public DbSet<Bank> Banks => Set<Bank>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<TaskAssignment> TaskAssignments => Set<TaskAssignment>();
    public DbSet<TaskDependency> TaskDependencies => Set<TaskDependency>();
    public DbSet<ProjectMilestone> ProjectMilestones => Set<ProjectMilestone>();

    public DbSet<PersonTimeOff> TimeOffs => Set<PersonTimeOff>();
    public DbSet<Holiday> Holidays => Set<Holiday>();

    public DbSet<Scenario> Scenarios => Set<Scenario>();
    public DbSet<ScenarioTaskOverride> ScenarioOverrides => Set<ScenarioTaskOverride>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        foreach (var entityType in b.Model.GetEntityTypes())
        {
            foreach (var property in entityType.GetProperties())
            {
                if (property.ClrType == typeof(DateTime) || property.ClrType == typeof(DateTime?))
                {
                    property.SetValueConverter(new ValueConverter<DateTime, DateTime>(
                        v => v.Kind == DateTimeKind.Utc ? v : v.ToUniversalTime(),
                        v => DateTime.SpecifyKind(v, DateTimeKind.Utc)));
                }
            }
        }

        b.Entity<TaskAssignment>()
        .HasOne(a => a.Task)      // adjust property names
        .WithMany() //t => t.Assignments
        .HasForeignKey(a => a.TaskId)
        .OnDelete(DeleteBehavior.Cascade);


        b.Entity<Person>().HasIndex(p => p.Name).IsUnique();
        b.Entity<Bank>().HasIndex(p => p.Name).IsUnique();
        b.Entity<Project>().HasOne(p => p.Bank).WithMany().HasForeignKey(p => p.BankId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskItem>().HasOne(t => t.Project).WithMany().HasForeignKey(t => t.ProjectId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskAssignment>().HasOne(a => a.Task).WithMany().HasForeignKey(a => a.TaskId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskAssignment>().HasOne(a => a.Person).WithMany().HasForeignKey(a => a.PersonId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskDependency>().HasOne(d => d.Task).WithMany().HasForeignKey(d => d.TaskId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskDependency>().HasOne(d => d.DependsOnTask).WithMany().HasForeignKey(d => d.DependsOnTaskId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<ProjectMilestone>().HasOne(m => m.Project).WithMany().HasForeignKey(m => m.ProjectId).OnDelete(DeleteBehavior.Cascade);

        // UTC converters
        b.Entity<TaskItem>().Property(t => t.StartDate).HasConversion(
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc)
        );
        b.Entity<ProjectMilestone>().Property(m => m.Date).HasConversion(
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc)
        );
        b.Entity<PersonTimeOff>().Property(p => p.Date).HasConversion(
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc)
        );
        b.Entity<Scenario>().Property(s => s.CreatedAt).HasConversion(
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc),
            v => DateTime.SpecifyKind(v, DateTimeKind.Utc)
        );

        b.Entity<ProjectPhase>()
      .HasOne(pp => pp.Project)
      .WithMany(p => p.Phases!)
      .HasForeignKey(pp => pp.ProjectId)
      .OnDelete(DeleteBehavior.Cascade);

        b.Entity<TaskItem>()
          .HasOne(t => t.Phase)
          .WithMany()                // tasks “reference” phases; phases don’t track tasks
          .HasForeignKey(t => t.PhaseId)
          .OnDelete(DeleteBehavior.SetNull);
    }

    public DbSet<ProjectPhase> ProjectPhases => Set<ProjectPhase>();
}

public record Person
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int CapacityHoursPerWeek { get; set; } = 40;
    public string[] Skills { get; set; } = Array.Empty<string>();
    public string Color { get; set; } = "#6b7280";
}

public record Bank
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public string Color { get; set; } = "#0ea5e9";
}

public record Project
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int BankId { get; set; }
    [JsonIgnore] public Bank? Bank { get; set; }
    public string? Color { get; set; }
    public DateTime? Deadline { get; set; }

    // NEW
    public List<ProjectPhase> Phases { get; set; } = new();
}

public enum TaskStatus { Backlog, Planned, InProgress, Blocked, Done }

public record TaskItem
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public Project? Project { get; set; }
    public string Title { get; set; } = "";
    public int EstimatedDays { get; set; } = 5;
    public DateTime StartDate { get; set; }
    public int DurationDays { get; set; } = 5;
    public TaskStatus Status { get; set; } = TaskStatus.Planned;
    public bool IsMilestone { get; set; } = false;
    public string[] RequiredSkills { get; set; } = Array.Empty<string>();
    public int? OptimisticDays { get; set; }
    public int? MostLikelyDays { get; set; }
    public int? PessimisticDays { get; set; }

    // NEW
    public int? PhaseId { get; set; }
    public ProjectPhase? Phase { get; set; }
}

public record TaskAssignment
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    [JsonIgnore] public TaskItem? Task { get; set; }
    public int PersonId { get; set; }
    [JsonIgnore] public Person? Person { get; set; }
    public int SharePercent { get; set; } = 100;
    public bool IsPrimary { get; set; } = true;
}

public record TaskDependency
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    [JsonIgnore] public TaskItem? Task { get; set; }
    public int DependsOnTaskId { get; set; }
    [JsonIgnore] public TaskItem? DependsOnTask { get; set; }
}

public record ProjectMilestone
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    [JsonIgnore] public Project? Project { get; set; }
    public string Name { get; set; } = "";
    public DateTime Date { get; set; } // UTC
}

public record PersonTimeOff { public int Id { get; set; } public int PersonId { get; set; } public DateTime Date { get; set; } public int Hours { get; set; } = 8; }
public record Holiday { public int Id { get; set; } public DateTime Date { get; set; } public string Name { get; set; } = ""; public string Region { get; set; } = "default"; }

public record Scenario { public int Id { get; set; } public string Name { get; set; } = ""; public DateTime CreatedAt { get; set; } = DateTime.UtcNow; }
public record ScenarioTaskOverride { public int Id { get; set; } public int ScenarioId { get; set; } public int TaskId { get; set; } public DateTime? StartDate { get; set; } public int? DurationDays { get; set; } public int? PrimaryPersonId { get; set; } }
// Add near other records
public record ProjectPhase
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public Project? Project { get; set; }
    public string Title { get; set; } = "";
    public int EstimatedDays { get; set; } = 5;
}


