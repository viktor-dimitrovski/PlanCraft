using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlanCraft.Api.Contracts;
using static PlanCraft.Api.GridModels;

namespace PlanCraft.Api.Handlers;

public static class PlanHandlers
{

    public sealed record GridRequest(
    [FromQuery] DateTime? From,
    [FromQuery] DateTime? To,
    [FromQuery] int? ScenarioId // reserved, not used now
);

    // -------- Output DTOs (only fields used by NewGrid.jsx) --------
    public sealed class AssignmentOut
    {
        public int Id { get; set; }
        public int PhaseId { get; set; }
        public int PersonId { get; set; }
        public DateTime StartDate { get; set; }
        public int AssignedDays { get; set; }
        public int? ParentAssignmentId { get; set; }
    }

    public sealed class PhaseOut
    {
        public int Id { get; set; }
        public int ProjectId { get; set; }
        public string? Title { get; set; }
        public int? EstimatedDays { get; set; }
        public DateTime? StartDate { get; set; }
        public int? DurationDays { get; set; }
        public PhaseStatus Status { get; set; }
        public string? Description { get; set; }
        public int? Priority { get; set; }
        public int? DependantPhaseId { get; set; }
        public bool? CanGoInParalelWith { get; set; }
        public List<AssignmentOut> Assignments { get; set; } = new();
    }

    public sealed class ProjectOut
    {
        public int Id { get; set; }
        public int BankId { get; set; }
        public string Name { get; set; } = "";
        public List<PhaseOut> Phases { get; set; } = new();
    }

    public sealed class BankOut
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string? Color { get; set; }
        public List<ProjectOut> Projects { get; set; } = new();
    }

    public sealed class PersonOut
    {
        public int Id { get; set; }
        public string Name { get; set; } = "";
        public string? Color { get; set; }
    }

    // GET /api/plan/phases?from=YYYY-MM-DD&to=YYYY-MM-DD
    // Improved to always return the full catalog:
    // - All banks (except the special 'TEMPLATES' bank), even if they have no projects
    // - All projects for all banks, even if they have no phases
    // - All phases for all projects, even if they have no assignments
    // - All assignments (no status/time filters)
    // - All people (legend), regardless of assignment
    public static async Task<IResult> GetFullPlanByPhases([FromServices] PlanCraftDb db, [AsParameters] GridRequest q)
    {
        // 1) People (legend/colors) — unconditional
        var people = await db.People
            .AsNoTracking()
            .OrderBy(p => p.Name)
            .Select(p => new PersonOut { Id = p.Id, Name = p.Name, Color = p.Color })
            .ToListAsync();

        // 2) Banks — include all except the special templates container (case-insensitive match)
        var banks = await db.Banks
            .AsNoTracking()
            .Where(b => b.Name != null && !EF.Functions.Like(b.Name, "%TEMPLATE%")) // excludes 'TEMPLATES' bank
            .OrderBy(b => b.Name)
            .Select(b => new BankOut { Id = b.Id, Name = b.Name, Color = b.Color })
            .ToListAsync();
        var bankById = banks.ToDictionary(b => b.Id);

        // 3) Projects — all projects, regardless of whether they have phases
        var projects = await db.Projects
            .AsNoTracking()
            .Select(p => new ProjectOut { Id = p.Id, BankId = p.BankId, Name = p.Name })
            .ToListAsync();
        var projectById = projects.ToDictionary(p => p.Id);

        // 4) Phases — all phases, regardless of date/status or assignments
        var phases = await db.ProjectPhases
            .AsNoTracking()
            .Select(ph => new PhaseOut
            {
                Id = ph.Id,
                ProjectId = ph.ProjectId,
                Title = ph.Title,
                EstimatedDays = ph.EstimatedDays,
                StartDate = ph.StartDate,
                DurationDays = ph.DurationDays,
                Status = ph.Status,
                Description = ph.Description,
                Priority = ph.Priority,
                DependantPhaseId = ph.DependantPhaseId,
                CanGoInParalelWith = true
            })
            .ToListAsync();
        var phaseById = phases.ToDictionary(ph => ph.Id);

        // 5) Assignments — all, no filters
        var assignments = await db.PhaseAssignments
            .AsNoTracking()
            .Select(a => new AssignmentOut
            {
                Id = a.Id,
                PhaseId = a.PhaseId,
                PersonId = a.PersonId,
                StartDate = a.StartDate ?? DateTime.UtcNow.Date,
                AssignedDays = a.AssignedDays,
                ParentAssignmentId = a.ParentAssignmentId
            })
            .ToListAsync();

        // 6) Attach assignments → phases
        foreach (var a in assignments)
        {
            if (phaseById.TryGetValue(a.PhaseId, out var ph))
                ph.Assignments.Add(a);
        }

        // 7) Attach phases → projects
        foreach (var ph in phases)
        {
            if (projectById.TryGetValue(ph.ProjectId, out var pr))
                pr.Phases.Add(ph);
        }

        // 8) Attach projects → banks
        foreach (var pr in projects)
        {
            if (bankById.TryGetValue(pr.BankId, out var b))
                b.Projects.Add(pr);
        }

        // 9) Final payload (banks tree  people)
        var payload = new { banks, people };
        return Results.Ok(payload);
    }
}
