using Microsoft.EntityFrameworkCore;
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

    protected override void OnModelCreating(ModelBuilder b)
    {
        b.Entity<Person>().HasIndex(p => p.Name).IsUnique();
        b.Entity<Bank>().HasIndex(p => p.Name).IsUnique();
        b.Entity<Project>().HasOne(p => p.Bank).WithMany().HasForeignKey(p => p.BankId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskItem>().HasOne(t => t.Project).WithMany().HasForeignKey(t => t.ProjectId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskAssignment>().HasOne(a => a.Task).WithMany().HasForeignKey(a => a.TaskId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskAssignment>().HasOne(a => a.Person).WithMany().HasForeignKey(a => a.PersonId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskDependency>().HasOne(d => d.Task).WithMany().HasForeignKey(d => d.TaskId).OnDelete(DeleteBehavior.Cascade);
        b.Entity<TaskDependency>().HasOne(d => d.DependsOnTask).WithMany().HasForeignKey(d => d.DependsOnTaskId).OnDelete(DeleteBehavior.Restrict);
        b.Entity<ProjectMilestone>().HasOne(m => m.Project).WithMany().HasForeignKey(m => m.ProjectId).OnDelete(DeleteBehavior.Cascade);
    }
}

public record Person
{
    public int Id { get; set; }
    public string Name { get; set; } = "";
    public int CapacityHoursPerWeek { get; set; } = 40;
    public string[] Skills { get; set; } = Array.Empty<string>();
    public string Color { get; set; } = "#6b7280"; // gray
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
}

public enum TaskStatus { Backlog, Planned, InProgress, Blocked, Done }

public record TaskItem
{
    public int Id { get; set; }
    public int ProjectId { get; set; }
    [JsonIgnore] public Project? Project { get; set; }
    public string Title { get; set; } = "";
    public int EstimatedDays { get; set; } = 5;
    public DateTime StartDate { get; set; }
    public int DurationDays { get; set; } = 5; // may differ from estimate
    public TaskStatus Status { get; set; } = TaskStatus.Planned;
    public bool IsMilestone { get; set; } = false;
    public string[] RequiredSkills { get; set; } = Array.Empty<string>();
}

public record TaskAssignment
{
    public int Id { get; set; }
    public int TaskId { get; set; }
    [JsonIgnore] public TaskItem? Task { get; set; }
    public int PersonId { get; set; }
    [JsonIgnore] public Person? Person { get; set; }
    public int SharePercent { get; set; } = 100; // if multiple devs, sum near 100
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
    public DateTime Date { get; set; }
}
