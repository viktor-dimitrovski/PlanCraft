using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using PlanCraft.Api.Contracts;
using static PlanCraft.Api.GridModels;

namespace PlanCraft.Api.Handlers;

public static class PlanHandlers
{
    public static async Task<IResult> GetFullPlanByTasks(PlanCraftDb db, DateTime from, DateTime to, int? scenarioId)
    {
        from = DateTime.SpecifyKind(from, DateTimeKind.Utc);
        to = DateTime.SpecifyKind(to, DateTimeKind.Utc);

        var weeks = DateUtil.WeekStarts(from, to).Select((w, idx) => new WeekInfo(w, w.AddDays(7), idx)).ToList();

        var people = await db.People.OrderBy(p => p.Name).ToListAsync();
        var tasks = await db.Tasks.Include(t => t.Project).ThenInclude(p => p!.Bank).ToListAsync();
        var assigns = await db.TaskAssignments.ToListAsync();
        var deps = await db.TaskDependencies.ToListAsync();
        var milestones = await db.ProjectMilestones.Include(m => m.Project).ThenInclude(p => p!.Bank).ToListAsync();

        if (scenarioId.HasValue)
        {
            var ovs = await db.ScenarioOverrides.Where(o => o.ScenarioId == scenarioId.Value).ToListAsync();
            foreach (var o in ovs)
            {
                var t = tasks.FirstOrDefault(x => x.Id == o.TaskId);
                if (t == null) continue;
                if (o.StartDate.HasValue) t.StartDate = DateTime.SpecifyKind(o.StartDate.Value, DateTimeKind.Utc);
                if (o.DurationDays.HasValue) t.DurationDays = o.DurationDays.Value;
                if (o.PrimaryPersonId.HasValue)
                {
                    var prim = assigns.FirstOrDefault(a => a.TaskId == t.Id && a.IsPrimary);
                    if (prim != null) prim.PersonId = o.PrimaryPersonId.Value;
                }
            }
        }

        var projGroups = tasks.GroupBy(t => t.ProjectId).ToDictionary(
            g => g.Key,
            g => PlanningLogic.CriticalPath(
                    g.First().Project!,
                    g.ToList(),
                    deps.Where(d => g.Select(x => x.Id).Contains(d.TaskId) || g.Select(x => x.Id).Contains(d.DependsOnTaskId)).ToList()
                )
        );

        List<PersonRow> rows = new();
        foreach (var p in people)
        {
            var util = weeks.Select(w => 0.0).ToList();
            var tlist = new List<GridTask>();

            foreach (var w in weeks)
            {
                double hours = 0;
                foreach (var a in assigns.Where(a => a.PersonId == p.Id))
                {
                    var t = tasks.First(t => t.Id == a.TaskId);
                    var days = DateUtil.OverlapDays(t.StartDate, t.DurationDays, w.Start);
                    if (days <= 0) continue;
                    hours += days * 8.0 * (a.SharePercent / 100.0);
                }
                var cap = PlanningLogic.EffectiveCapacity(db, p.Id, w.Start, p.CapacityHoursPerWeek);
                util[w.Index] = cap > 0 ? Math.Min(1.5, hours / cap) : 0;
            }

            foreach (var a in assigns.Where(x => x.PersonId == p.Id && x.IsPrimary))
            {
                var t = tasks.First(t => t.Id == a.TaskId);
                var wStartIdx = weeks.FindIndex(w => w.Start <= t.StartDate && t.StartDate < w.End);
                if (wStartIdx < 0) continue;
                var span = Math.Max(1, (int)Math.Ceiling(t.DurationDays / 7.0));
                var projectName = t.Project?.Name ?? "Project";
                var color = t.Project?.Color ?? t.Project?.Bank?.Color ?? "#60a5fa";

                var assignmentDtos = assigns.Where(z => z.TaskId == t.Id)
                    .Select(z => new Assignment(z.Id, z.PersonId, z.SharePercent, z.IsPrimary)).ToList();
                var depIds = deps.Where(d => d.TaskId == t.Id).Select(d => d.DependsOnTaskId).ToArray();
                var depDtos = deps.Where(d => d.TaskId == t.Id)
                                  .Select(d => tasks.FirstOrDefault(x => x.Id == d.DependsOnTaskId))
                                  .Where(x => x != null)
                                  .Select(x => new DepDto(x!.Id, x.Title, x.Project!.Name)).ToList();
                var blocked = deps.Where(d => d.TaskId == t.Id).Any(d =>
                {
                    var pred = tasks.First(x => x.Id == d.DependsOnTaskId);
                    var predEnd = pred.StartDate.AddDays(pred.DurationDays);
                    return predEnd > t.StartDate;
                });

                var (criticalSet, slackDays) = projGroups[t.ProjectId];
                bool isCritical = criticalSet.Contains(t.Id);
                int slack = slackDays.ContainsKey(t.Id) ? slackDays[t.Id] : 0;

                tlist.Add(new GridTask(
                    t.Id, t.Title, projectName, color!, wStartIdx, span,
                    t.EstimatedDays, t.DurationDays,
                    assignmentDtos, depIds, depDtos,
                    t.Status.ToString(), blocked, isCritical, slack));
            }

            rows.Add(new PersonRow(p.Id, p.Name, p.CapacityHoursPerWeek, util, tlist, p.Color));
        }

        var ms = milestones.Select(m => new Milestone(m.Project!.Name, m.Name, m.Date, m.Project!.Color ?? m.Project!.Bank!.Color)).ToList();
        return Results.Ok(new GridResponse(weeks, rows, ms));
    }

    public static async Task<IResult> Move(PlanCraftDb db, MoveReq req)
    {
        var task = await db.Tasks.FindAsync(req.TaskId);
        if (task == null) return Results.NotFound();

        if (req.Copy)
        {
            var clone = new TaskItem
            {
                ProjectId = task.ProjectId,
                Title = task.Title,
                EstimatedDays = task.EstimatedDays,
                StartDate = req.NewStartDate.HasValue ? DateTime.SpecifyKind(req.NewStartDate.Value, DateTimeKind.Utc) : task.StartDate,
                DurationDays = req.NewDurationDays ?? task.DurationDays,
                Status = task.Status,
                IsMilestone = task.IsMilestone,
                RequiredSkills = task.RequiredSkills,
                OptimisticDays = task.OptimisticDays,
                MostLikelyDays = task.MostLikelyDays,
                PessimisticDays = task.PessimisticDays
            };
            db.Tasks.Add(clone);
            await db.SaveChangesAsync();
            var assigns = db.TaskAssignments.Where(a => a.TaskId == task.Id).ToList();
            foreach (var a in assigns)
                db.TaskAssignments.Add(new TaskAssignment
                {
                    TaskId = clone.Id,
                    PersonId = req.NewPrimaryPersonId ?? a.PersonId,
                    SharePercent = a.SharePercent,
                    IsPrimary = a.IsPrimary
                });
            await db.SaveChangesAsync();
            return Results.Ok(clone);
        }

        if (req.NewStartDate.HasValue) task.StartDate = DateTime.SpecifyKind(req.NewStartDate.Value, DateTimeKind.Utc);
        if (req.NewDurationDays.HasValue) task.DurationDays = Math.Max(1, req.NewDurationDays.Value);
        var primary = await db.TaskAssignments.FirstOrDefaultAsync(a => a.TaskId == req.TaskId && a.IsPrimary);
        if (req.NewPrimaryPersonId.HasValue)
        {
            if (primary != null) { primary.PersonId = req.NewPrimaryPersonId.Value; db.TaskAssignments.Update(primary); }
            else { db.TaskAssignments.Add(new TaskAssignment { TaskId = req.TaskId, PersonId = req.NewPrimaryPersonId.Value, SharePercent = 100, IsPrimary = true }); }
        }

        await db.SaveChangesAsync();
        return Results.Ok(task);
    }

    public static async Task<IResult> AutoBalance(PlanCraftDb db, BalanceReq req)
    {
        req = req with { From = DateTime.SpecifyKind(req.From, DateTimeKind.Utc), To = DateTime.SpecifyKind(req.To, DateTimeKind.Utc) };
        var moves = await PlanningLogic.AutoBalanceAsync(db, req.From, req.To, req.TargetLoad);
        return Results.Ok(new { proposals = moves });
    }

    public static async Task<IResult> Compare(PlanCraftDb db, int scenarioId)
    {
        var tasks = await db.Tasks.Include(t => t.Project).ToListAsync();
        var baseFinish = tasks.GroupBy(t => t.ProjectId).ToDictionary(g => g.Key, g => g.Max(t => t.StartDate.AddDays(t.DurationDays)));
        var ovs = await db.ScenarioOverrides.Where(o => o.ScenarioId == scenarioId).ToListAsync();
        foreach (var o in ovs)
        {
            var t = tasks.FirstOrDefault(x => x.Id == o.TaskId);
            if (t == null) continue;
            var start = o.StartDate ?? t.StartDate;
            var dur = o.DurationDays ?? t.DurationDays;
            t = t with { StartDate = start, DurationDays = dur };
        }
        var scenFinish = tasks.GroupBy(t => t.ProjectId).ToDictionary(g => g.Key, g => g.Max(t => t.StartDate.AddDays(t.DurationDays)));
        var result = baseFinish.Select(kv => new
        {
            ProjectId = kv.Key,
            BaseFinish = kv.Value,
            ScenarioFinish = scenFinish[kv.Key],
            SlipDays = (scenFinish[kv.Key] - kv.Value).TotalDays
        });
        return Results.Ok(result);
    }

    public static async Task<IResult> Forecast(PlanCraftDb db, int projectId, int trials = 200)
    {
        var tasks = await db.Tasks.Where(t => t.ProjectId == projectId).ToListAsync();
        var deps = await db.TaskDependencies.ToListAsync();
        var rand = new Random(1);
        List<DateTime> finishes = new();
        for (int i = 0; i < trials; i++)
        {
            var dur = tasks.ToDictionary(t => t.Id, t =>
            {
                int o = t.OptimisticDays ?? t.DurationDays, m = t.MostLikelyDays ?? t.DurationDays, p = t.PessimisticDays ?? t.DurationDays;
                return (int)Math.Round((o + 4 * m + p) / 6.0 + rand.NextDouble() * 2 - 1);
            });
            var start = tasks.ToDictionary(t => t.Id, t => t.StartDate);
            bool changed = true; int guard = 0;
            while (changed && guard < 1000)
            {
                changed = false; guard++;
                foreach (var t in tasks)
                {
                    var preds = deps.Where(d => d.TaskId == t.Id).Select(d => d.DependsOnTaskId);
                    var latest = preds.Any() ? preds.Max(pid => start[pid].AddDays(dur[pid])) : start[t.Id];
                    if (latest > start[t.Id]) { start[t.Id] = latest; changed = true; }
                }
            }
            var finish = tasks.Max(t => start[t.Id].AddDays(dur[t.Id]));
            finishes.Add(finish);
        }
        finishes.Sort();
        DateTime p50 = finishes[(int)(finishes.Count * 0.5)];
        DateTime p90 = finishes[(int)(finishes.Count * 0.9)];
        return Results.Ok(new { P50 = p50, P90 = p90, Trials = trials });
    }

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
