using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api.Handlers
{
    // Adjust DbContext type if yours is named differently
    public static class PlanGridHandlers
    {
        // -------- Request DTO --------
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
        public static async Task<IResult> GetGrid2([FromServices] PlanCraftDb db, [AsParameters] GridRequest q)
        {
            var from = (q.From ?? DateTime.UtcNow.Date).Date;
            var to = (q.To ?? from.AddMonths(5)).Date;

            // 1) People (legend/colors)
            var people = await db.People
                .AsNoTracking()
                .OrderBy(p => p.Name)
                .Select(p => new PersonOut { Id = p.Id, Name = p.Name, Color = p.Color })
                .ToListAsync();

            // 2) Assignments that intersect the window: Start < to && Start+Days > from
            var assignments = await db.PhaseAssignments
                .AsNoTracking()
                .Where(a => a.StartDate.HasValue &&                      // has start
                            a.StartDate.Value < to &&                    // starts before window end
                            a.StartDate.Value.AddDays(a.AssignedDays) > from)  // derived end = Start + days and ends after window start
                .Select(a => new AssignmentOut
                {
                    Id = a.Id,
                    PhaseId = a.PhaseId,
                    PersonId = a.PersonId,
                    StartDate = (DateTime)a.StartDate,
                    AssignedDays = a.AssignedDays,
                    ParentAssignmentId = a.ParentAssignmentId
                })
                .ToListAsync();

            // 3) Phases referenced by those assignments (only minimal columns)
            var phaseIds = assignments.Select(a => a.PhaseId).Distinct().ToList();

            var phases = await db.ProjectPhases
                .AsNoTracking()
                .Where(ph => phaseIds.Contains(ph.Id))
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

            // 4) Projects for those phases
            var projectIds = phases.Select(ph => ph.ProjectId).Distinct().ToList();

            var projects = await db.Projects
                .AsNoTracking()
                .Where(p => projectIds.Contains(p.Id))
                .Select(p => new ProjectOut { Id = p.Id, BankId = p.BankId, Name = p.Name })
                .ToListAsync();

            // 5) Banks for those projects
            var bankIds = projects.Select(p => p.BankId).Distinct().ToList();

            var banks = await db.Banks
                .AsNoTracking()
                .Where(b => bankIds.Contains(b.Id))
                .OrderBy(b => b.Name)
                .Select(b => new BankOut { Id = b.Id, Name = b.Name, Color = b.Color })
                .ToListAsync();

            // 6) Build lookups for easy attaching
            var phaseById = phases.ToDictionary(x => x.Id);
            var projectById = projects.ToDictionary(x => x.Id);
            var bankById = banks.ToDictionary(x => x.Id);

            // 7) Attach assignments → phases
            foreach (var a in assignments)
            {
                if (phaseById.TryGetValue(a.PhaseId, out var ph))
                    ph.Assignments.Add(a);
            }

            // 8) Attach phases → projects
            foreach (var ph in phases)
            {
                if (projectById.TryGetValue(ph.ProjectId, out var pr))
                    pr.Phases.Add(ph);
            }

            // 9) Attach projects → banks
            foreach (var pr in projects)
            {
                if (bankById.TryGetValue(pr.BankId, out var b))
                    b.Projects.Add(pr);
            }

            // 10) Final payload (banks tree + people)
            var payload = new
            {
                banks,
                people
            };

            return Results.Ok(payload);
        }
        // GET /api/plan/phases?from=YYYY-MM-DD&to=YYYY-MM-DD
        public static async Task<IResult> GetGrid([FromServices] PlanCraftDb db, [AsParameters] GridRequest q)
        {
            // Normalize the requested window to dates (client sends date-only)
            var from = (q.From ?? DateTime.UtcNow.Date).Date;
            var to = (q.To ?? from.AddMonths(5)).Date;

            // ---- People (legend/colors) ----
            var people = await db.People
                .AsNoTracking()
                .OrderBy(p => p.Name)
                .Select(p => new PersonOut { Id = p.Id, Name = p.Name, Color = p.Color })
                .ToListAsync();

            // ---- Assignments intersecting the window ----
            // Intersects if: StartDate < to AND (StartDate + AssignedDays) > from
            var aRows = await db.PhaseAssignments
                .AsNoTracking()
                 .Where(a => a.StartDate.HasValue &&                      // has start
                            a.StartDate.Value < to &&                    // starts before window end
                            a.StartDate.Value.AddDays(a.AssignedDays) > from)  // derived end = Start + days and ends after window start
                .Select(a => new
                {
                    a.Id,
                    a.PhaseId,
                    a.PersonId,
                    a.StartDate,
                    a.AssignedDays,
                    a.ParentAssignmentId
                })
                .ToListAsync();

            var phaseIdsFromAssignments = aRows.Select(x => x.PhaseId).Distinct().ToList();

            // ---- Phases to include ----
            // Include phases referenced by assignments, plus phases whose own time window overlaps the range
            var phaseIdsByWindow = await db.ProjectPhases
                .AsNoTracking()
                .Where(ph =>
                    ph.StartDate != null &&
                    ph.StartDate < to &&
                    ph.StartDate.Value.AddDays(ph.DurationDays ?? ph.EstimatedDays) > from)
                .Select(ph => ph.Id)
                .ToListAsync();

            var allPhaseIds = phaseIdsFromAssignments
                .Concat(phaseIdsByWindow)
                .Distinct()
                .ToList();

            var pRows = await db.ProjectPhases
                .AsNoTracking()
                .Where(ph => allPhaseIds.Contains(ph.Id))
                .Select(ph => new
                {
                    ph.Id,
                    ph.ProjectId,
                    ph.Title,
                    ph.EstimatedDays,
                    ph.StartDate,
                    ph.DurationDays
                })
                .ToListAsync();

            // ---- Projects for those phases ----
            var projectIds = pRows.Select(x => x.ProjectId).Distinct().ToList();

            var prjRows = await db.Projects
                .AsNoTracking()
                .Where(p => projectIds.Contains(p.Id))
                .Select(p => new { p.Id, p.BankId, p.Name })
                .ToListAsync();

            // ---- Banks for those projects ----
            var bankIds = prjRows.Select(x => x.BankId).Distinct().ToList();

            var bankRows = await db.Banks
                .AsNoTracking()
                .Where(b => bankIds.Contains(b.Id))
                .OrderBy(b => b.Name)
                .Select(b => new { b.Id, b.Name, b.Color })
                .ToListAsync();

            // ---- Build nested DTOs ----
            // Phases
            var phasesById = pRows.ToDictionary(
                x => x.Id,
                x => new PhaseOut
                {
                    Id = x.Id,
                    ProjectId = x.ProjectId,
                    Title = x.Title,
                    EstimatedDays = x.EstimatedDays,
                    StartDate = x.StartDate,
                    DurationDays = x.DurationDays
                });

            // Attach assignments → phases
            foreach (var a in aRows)
            {
                if (phasesById.TryGetValue(a.PhaseId, out var ph))
                {
                    ph.Assignments.Add(new AssignmentOut
                    {
                        Id = a.Id,
                        PersonId = a.PersonId,
                        StartDate = (DateTime)a.StartDate,
                        AssignedDays = a.AssignedDays,
                        ParentAssignmentId = a.ParentAssignmentId
                    });
                }
            }

            // Projects
            var projectsById = prjRows.ToDictionary(
                x => x.Id,
                x => new ProjectOut { Id = x.Id, BankId = x.BankId, Name = x.Name });

            // Attach phases → projects
            foreach (var ph in phasesById.Values)
            {
                if (projectsById.TryGetValue(ph.ProjectId, out var prj))
                    prj.Phases.Add(ph);
            }

            // Banks
            var banksById = bankRows.ToDictionary(
                x => x.Id,
                x => new BankOut { Id = x.Id, Name = x.Name, Color = x.Color });

            // Attach projects → banks
            foreach (var prj in projectsById.Values)
            {
                if (banksById.TryGetValue(prj.BankId, out var bank))
                    bank.Projects.Add(prj);
            }

            // ---- Final payload ----
            var payload = new
            {
                banks = banksById.Values
                    .OrderBy(b => b.Name)
                    .ToList(),
                people
            };

            return Results.Ok(payload);
        }

    }
}
