namespace PlanCraft.Api;

public record PlanPhaseReq(int PersonId, DateTime StartDateUtc, string[]? RequiredSkills);
public record MoveReq(int TaskId, DateTime? NewStartDate, int? NewPrimaryPersonId, int? NewDurationDays, bool Copy);
public record BalanceReq(DateTime From, DateTime To, double TargetLoad = 0.85);
