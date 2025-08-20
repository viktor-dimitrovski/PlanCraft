using Microsoft.EntityFrameworkCore;

namespace PlanCraft.Api;

public static class DateUtil
{
    public static DateTime FloorToMonday(DateTime d)
    {
        int diff = (7 + (d.DayOfWeek - DayOfWeek.Monday)) % 7;
        return d.Date.AddDays(-diff);
    }
    public static IEnumerable<DateTime> WeekStarts(DateTime from, DateTime to)
    {
        var cur = FloorToMonday(from);
        while (cur <= to) { yield return cur; cur = cur.AddDays(7); }
    }
    public static int OverlapDays(DateTime start, int durationDays, DateTime weekStart)
    {
        var a1 = start.Date;
        var a2 = start.Date.AddDays(Math.Max(0, durationDays));
        var b1 = weekStart.Date;
        var b2 = weekStart.Date.AddDays(7);
        var startMax = a1 > b1 ? a1 : b1;
        var endMin = a2 < b2 ? a2 : b2;
        var diff = (endMin - startMax).TotalDays;
        return (int)Math.Max(0, Math.Ceiling(diff));
    }
}

public class GridModels
{
    public record GridResponse(List<WeekInfo> Weeks, List<PersonRow> People, List<Milestone> Milestones);
    public record WeekInfo(DateTime Start, DateTime End, int Index);
    public record PersonRow(int Id, string Name, int CapacityHoursPerWeek, List<double> WeeklyUtilization, List<GridTask> Tasks);
    public record GridTask(int Id, string Title, string ProjectName, string ProjectColor, int WeekIndex, int WeekSpan, int EstimatedDays, int DurationDays, List<Assignment> Assignments, int[] DependencyIds, string Status);
    public record Assignment(int PersonId, int SharePercent, bool IsPrimary);
    public record Milestone(string ProjectName, string Name, DateTime Date, string Color);
}

public static class PlanningLogic
{
    // simple heuristic to propose moving tasks from overloaded to underutilized people
    public static async Task<List<MoveProposal>> AutoBalanceAsync(PlanCraftDb db, DateTime from, DateTime to, double targetLoad = 0.85)
    {
        var people = await db.People.OrderBy(p=>p.Id).ToListAsync();
        var tasks = await db.Tasks.ToListAsync();
        var assigns = await db.TaskAssignments.ToListAsync();
        var projects = await db.Projects.Include(p=>p.Bank).ToListAsync();

        var weekStarts = DateUtil.WeekStarts(from, to).ToList();
        var load = new Dictionary<(int personId, DateTime week), double>();

        foreach (var p in people)
            foreach (var w in weekStarts)
                load[(p.Id, w)] = 0.0;

        foreach (var a in assigns)
        {
            var t = tasks.First(x=>x.Id==a.TaskId);
            foreach (var w in weekStarts)
            {
                var days = DateUtil.OverlapDays(t.StartDate, t.DurationDays, w);
                if (days<=0) continue;
                var hours = days * 8.0 * (a.SharePercent/100.0);
                var cap = people.First(x=>x.Id==a.PersonId).CapacityHoursPerWeek;
                if (cap>0) load[(a.PersonId, w)] += hours / cap;
            }
        }

        var moves = new List<MoveProposal>();
        foreach (var a in assigns.Where(z=>z.IsPrimary))
        {
            var t = tasks.First(x=>x.Id==a.TaskId);
            foreach (var w in weekStarts)
            {
                var days = DateUtil.OverlapDays(t.StartDate, t.DurationDays, w);
                if (days<=0) continue;
                var overloaded = load[(a.PersonId, w)] > 1.0;
                if (!overloaded) continue;

                // find underutilized person same week
                var candidate = people.OrderBy(p => load[(p.Id,w)]).FirstOrDefault(p => load[(p.Id,w)] < targetLoad);
                if (candidate is null || candidate.Id==a.PersonId) continue;

                moves.Add(new MoveProposal{
                    TaskId = t.Id,
                    FromPersonId = a.PersonId,
                    ToPersonId = candidate.Id,
                    WeekStart = w,
                    Reason = $"Balance load {load[(a.PersonId,w)]:0.0} → {load[(candidate.Id,w)]:0.0}"
                });
                break; // one proposal per task
            }
        }
        return moves;
    }

    public class MoveProposal
    {
        public int TaskId { get; set; }
        public int FromPersonId { get; set; }
        public int ToPersonId { get; set; }
        public DateTime WeekStart { get; set; }
        public string Reason { get; set; } = "";
    }
}
