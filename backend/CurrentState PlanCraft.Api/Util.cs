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
    public record PersonRow(int Id, string Name, int CapacityHoursPerWeek, List<double> WeeklyUtilization, List<GridTask> Tasks, string Color);
    public record GridTask(
        int Id, string Title, string ProjectName, string ProjectColor,
        int WeekIndex, int WeekSpan, int EstimatedDays, int DurationDays,
        List<Assignment> Assignments, int[] DependencyIds, List<DepDto> Dependencies, string Status,
        bool Blocked, bool IsCritical, int SlackDays
    );
    public record Assignment(int Id, int PersonId, int SharePercent, bool IsPrimary);
    public record DepDto(int Id, string Title, string ProjectName);
    public record Milestone(string ProjectName, string Name, DateTime Date, string Color);
}

public static class PlanningLogic
{
    public static int EffectiveCapacity(PlanCraft.Api.PlanCraftDb db, int personId, DateTime weekStart, int baseCap)
    {
        var pto = db.TimeOffs.Where(t => t.PersonId==personId && t.Date>=weekStart && t.Date<weekStart.AddDays(7)).Sum(t=>t.Hours);
        var hol = db.Holidays.Where(h => h.Date>=weekStart && h.Date<weekStart.AddDays(7)).Count() * 8;
        return Math.Max(0, baseCap - (int)pto - hol);
    }

    public static async Task<List<MoveProposal>> AutoBalanceAsync(PlanCraftDb db, DateTime from, DateTime to, double targetLoad = 0.85)
    {
        var people = await db.People.OrderBy(p=>p.Id).ToListAsync();
        var tasks = await db.Tasks.Include(t=>t.Project).ToListAsync();
        var assigns = await db.TaskAssignments.ToListAsync();

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
                var cap = EffectiveCapacity(db, a.PersonId, w, people.First(x=>x.Id==a.PersonId).CapacityHoursPerWeek);
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

                var candidate = people
                    .Where(p => (t.RequiredSkills.Length==0 || t.RequiredSkills.All(s => p.Skills.Contains(s))))
                    .OrderBy(p => load[(p.Id,w)]).FirstOrDefault(p => load[(p.Id,w)] < targetLoad);
                if (candidate is null || candidate.Id==a.PersonId) continue;

                moves.Add(new MoveProposal{
                    TaskId = t.Id,
                    FromPersonId = a.PersonId,
                    ToPersonId = candidate.Id,
                    WeekStart = w,
                    Reason = $"Balance load {load[(a.PersonId,w)]:0.0} → {load[(candidate.Id,w)]:0.0} (skills ok)"
                });
                break;
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

    public static (HashSet<int> critical, Dictionary<int,int> slackDays) CriticalPath(Project project, List<TaskItem> projectTasks, List<TaskDependency> deps)
    {
        var tasks = projectTasks.ToDictionary(t=>t.Id);
        var g = new Dictionary<int, List<int>>();
        var indeg = new Dictionary<int, int>();
        foreach (var t in tasks.Keys){ g[t]=new(); indeg[t]=0; }
        foreach (var d in deps.Where(d => tasks.ContainsKey(d.TaskId) && tasks.ContainsKey(d.DependsOnTaskId)))
        { g[d.DependsOnTaskId].Add(d.TaskId); indeg[d.TaskId]++; }

        var q = new Queue<int>(indeg.Where(kv=>kv.Value==0).Select(kv=>kv.Key));
        var order = new List<int>();
        while(q.Count>0){ var u=q.Dequeue(); order.Add(u); foreach(var v in g[u]){ indeg[v]--; if(indeg[v]==0) q.Enqueue(v); } }

        var dist = tasks.ToDictionary(kv=>kv.Key, kv=>0);
        foreach (var u in order){
            foreach (var v in g[u]){
                var cand = dist[u] + tasks[u].DurationDays;
                if (cand > dist[v]) dist[v]=cand;
            }
        }
        var maxDist = dist.Values.DefaultIfEmpty(0).Max();
        var rev = new Dictionary<int, List<int>>();
        foreach (var t in tasks.Keys) rev[t]=new();
        foreach (var (u,list) in g) foreach (var v in list) rev[v].Add(u);

        var critical = new HashSet<int>();
        foreach (var t in tasks.Keys){
            var finish = dist[t] + tasks[t].DurationDays;
            var slack = maxDist - finish;
            if (slack==0) critical.Add(t);
        }
        var slackDays = tasks.Keys.ToDictionary(id => id, id => {
            var finish = dist[id] + tasks[id].DurationDays;
            return maxDist - finish;
        });
        return (critical, slackDays);
    }
}
