using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage.ValueConversion;
using System.Text.Json.Serialization;

namespace PlanCraft.Api;

// ==============================
// DbContext
// ==============================
public class PlanCraftDb : DbContext
{
    public PlanCraftDb(DbContextOptions<PlanCraftDb> options) : base(options) { }

    // Core
    public DbSet<Person> People => Set<Person>();
    public DbSet<Bank> Banks => Set<Bank>();
    public DbSet<Project> Projects => Set<Project>();
    public DbSet<TaskItem> Tasks => Set<TaskItem>();
    public DbSet<TaskAssignment> TaskAssignments => Set<TaskAssignment>();
    public DbSet<TaskDependency> TaskDependencies => Set<TaskDependency>();
    public DbSet<ProjectMilestone> ProjectMilestones => Set<ProjectMilestone>();
    public DbSet<PersonTimeOff> TimeOffs => Set<PersonTimeOff>();
    public DbSet<Holiday> Holidays => Set<Holiday>();

    // Scenarios
    public DbSet<Scenario> Scenarios => Set<Scenario>();
    public DbSet<ScenarioTaskOverride> ScenarioOverrides => Set<ScenarioTaskOverride>();

    // Phases & Acceptance
    public DbSet<ProjectPhase> ProjectPhases => Set<ProjectPhase>();
    public DbSet<PhaseAcceptanceCriteria> PhaseAcceptanceCriteria => Set<PhaseAcceptanceCriteria>();
    public DbSet<PhaseAcceptanceRun> PhaseAcceptanceRuns => Set<PhaseAcceptanceRun>();
    public DbSet<PhaseAcceptanceResult> PhaseAcceptanceResults => Set<PhaseAcceptanceResult>();
    public DbSet<ProjectPhaseParallel> ProjectPhaseParallels => Set<ProjectPhaseParallel>();
    public DbSet<PhaseAssignment> PhaseAssignments => Set<PhaseAssignment>();

    protected override void OnModelCreating(ModelBuilder b)
    {
        // Force UTC for all DateTime/DateTime? columns
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

        // Indexes & basic relations
        b.Entity<Person>().HasIndex(p => p.Name).IsUnique();
        b.Entity<Bank>().HasIndex(p => p.Name).IsUnique();

        b.Entity<Project>()
            .HasOne(p => p.Bank).WithMany().HasForeignKey(p => p.BankId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<TaskItem>()
            .HasOne(t => t.Project).WithMany().HasForeignKey(t => t.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<TaskAssignment>()
            .HasOne(a => a.Task).WithMany().HasForeignKey(a => a.TaskId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskAssignment>()
            .HasOne(a => a.Person).WithMany().HasForeignKey(a => a.PersonId)
            .OnDelete(DeleteBehavior.Cascade);

        b.Entity<TaskDependency>()
            .HasOne(d => d.Task).WithMany().HasForeignKey(d => d.TaskId)
            .OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskDependency>()
            .HasOne(d => d.DependsOnTask).WithMany().HasForeignKey(d => d.DependsOnTaskId)
            .OnDelete(DeleteBehavior.Restrict);

        b.Entity<ProjectMilestone>()
            .HasOne(m => m.Project).WithMany().HasForeignKey(m => m.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // Task ↔ Phase (optional)
        b.Entity<TaskItem>()
            .HasOne(t => t.Phase).WithMany() // phases don't track tasks
            .HasForeignKey(t => t.PhaseId)
            .OnDelete(DeleteBehavior.SetNull);

        // ProjectPhase ↔ Project
        b.Entity<ProjectPhase>()
            .HasOne(pp => pp.Project).WithMany(p => p.Phases)
            .HasForeignKey(pp => pp.ProjectId)
            .OnDelete(DeleteBehavior.Cascade);

        // ProjectPhase self-dependency
        b.Entity<ProjectPhase>()
            .HasOne(p => p.DependantPhase).WithMany()
            .HasForeignKey(p => p.DependantPhaseId)
            .OnDelete(DeleteBehavior.Restrict);

        // Parallel phases M2M
        b.Entity<ProjectPhaseParallel>().HasKey(x => new { x.PhaseId, x.WithPhaseId });
        b.Entity<ProjectPhaseParallel>()
            .HasOne(x => x.Phase).WithMany(x => x.ParallelWith)
            .HasForeignKey(x => x.PhaseId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<ProjectPhaseParallel>()
            .HasOne(x => x.WithPhase).WithMany()
            .HasForeignKey(x => x.WithPhaseId).OnDelete(DeleteBehavior.Cascade);

        // Acceptance relations
        b.Entity<PhaseAcceptanceCriteria>()
            .HasOne(c => c.Phase).WithMany(p => p.AcceptanceCriteria)
            .HasForeignKey(c => c.PhaseId).OnDelete(DeleteBehavior.Cascade);

        b.Entity<PhaseAcceptanceRun>()
            .HasOne(r => r.Phase).WithMany(p => p.AcceptanceRuns)
            .HasForeignKey(r => r.PhaseId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<PhaseAcceptanceRun>()
            .HasOne(r => r.VerifiedByPerson).WithMany()
            .HasForeignKey(r => r.VerifiedByPersonId).OnDelete(DeleteBehavior.SetNull);

        b.Entity<PhaseAcceptanceResult>()
            .HasOne(r => r.Run).WithMany(rn => rn.Results)
            .HasForeignKey(r => r.RunId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<PhaseAcceptanceResult>()
            .HasOne(r => r.Criteria).WithMany()
            .HasForeignKey(r => r.CriteriaId).OnDelete(DeleteBehavior.Cascade);

        // Assignments
        b.Entity<PhaseAssignment>()
            .HasOne(a => a.Phase).WithMany(p => p.Assignments)
            .HasForeignKey(a => a.PhaseId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<PhaseAssignment>()
            .HasOne(a => a.Person).WithMany()
            .HasForeignKey(a => a.PersonId).OnDelete(DeleteBehavior.Cascade);
    }
}

// ==============================
// Domain
// ==============================

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

    // Phases
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

    // Optional link to phase
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

public record PersonTimeOff
{
    public int Id { get; set; }
    public int PersonId { get; set; }
    public DateTime Date { get; set; }
    public int Hours { get; set; } = 8;
}

public record Holiday
{
    public int Id { get; set; }
    public DateTime Date { get; set; }
    public string Name { get; set; } = "";
    public string Region { get; set; } = "default";
}

public record Scenario
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public record ScenarioTaskOverride
{
    public int Id { get; set; }
    public int ScenarioId { get; set; }
    public int TaskId { get; set; }
    public DateTime? StartDate { get; set; }
    public int? DurationDays { get; set; }
    public int? PrimaryPersonId { get; set; }
}

public enum PhaseStatus { Planned = 0, InProgress = 1, Blocked = 2, Done = 3, Canceled = 9 }
public enum AcceptanceStatus { NotTested = 0, Pass = 1, Fail = 2, AcceptedWithNote = 3 }
public enum VerificationStatus { NotStarted = 0, InProgress = 1, Passed = 2, Failed = 3, AcceptedWithNotes = 4 }

public record ProjectPhase
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    public Project? Project { get; set; }
    public string Title { get; set; } = "";
    public int EstimatedDays { get; set; }

    // Planning
    public DateTime? StartDate { get; set; }
    public int? DurationDays { get; set; }
    public PhaseStatus Status { get; set; } = PhaseStatus.Planned;
    public string? Description { get; set; }
    public int Priority { get; set; } = 0;
    public int? DependantPhaseId { get; set; }
    public ProjectPhase? DependantPhase { get; set; }

    // Many-to-many with other phases
    public List<ProjectPhaseParallel> ParallelWith { get; set; } = new();

    // Aggregates
    public int NoAssignedDays { get; set; } = 0;

    // Navigation
    public List<PhaseAcceptanceCriteria> AcceptanceCriteria { get; set; } = new();
    public List<PhaseAcceptanceRun> AcceptanceRuns { get; set; } = new();
    public List<PhaseAssignment> Assignments { get; set; } = new();

    [System.ComponentModel.DataAnnotations.Schema.NotMapped]
    public double PercentageComplete { get; set; } // computed in API
}

public record PhaseAcceptanceCriteria
{
    public int Id { get; set; }
    public int PhaseId { get; set; }
    public ProjectPhase? Phase { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public int Order { get; set; } = 0;
    public bool IsRequired { get; set; } = true;
    public AcceptanceStatus Status { get; set; } = AcceptanceStatus.NotTested; // overall status
}

public record PhaseAcceptanceRun
{
    public int Id { get; set; }
    public int PhaseId { get; set; }
    public ProjectPhase? Phase { get; set; }
    public int? VerifiedByPersonId { get; set; }
    public Person? VerifiedByPerson { get; set; }
    public DateTime? StartAt { get; set; }
    public DateTime? EndAt { get; set; }
    public DateTime? VerifiedAt { get; set; }
    public VerificationStatus OverallStatus { get; set; } = VerificationStatus.NotStarted;
    public string? Notes { get; set; }
    public List<PhaseAcceptanceResult> Results { get; set; } = new();
}

public record PhaseAcceptanceResult
{
    public int Id { get; set; }
    public int RunId { get; set; }
    public PhaseAcceptanceRun? Run { get; set; }
    public int CriteriaId { get; set; }
    public PhaseAcceptanceCriteria? Criteria { get; set; }
    public AcceptanceStatus Status { get; set; } = AcceptanceStatus.NotTested;
    public string? Note { get; set; }
    public DateTime? StartedAt { get; set; }
    public DateTime? FinishedAt { get; set; }
    public int? SpentMinutes { get; set; }
}

public record ProjectPhaseParallel
{
    public int PhaseId { get; set; }
    public ProjectPhase? Phase { get; set; }
    public int WithPhaseId { get; set; }
    public ProjectPhase? WithPhase { get; set; }
}

public record PhaseAssignment
{
    public int Id { get; set; }
    public int PhaseId { get; set; }
    public ProjectPhase? Phase { get; set; }
    public int PersonId { get; set; }
    public Person? Person { get; set; }
    public int AssignedDays { get; set; } // MD
    public DateTime? StartDate { get; set; } // when this assignment begins for the person
    public int? ParentAssignmentId { get; set; }
}
