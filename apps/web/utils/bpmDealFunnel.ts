import { BusinessProcess, Deal, ProcessInstance, ProcessStep, SalesFunnel } from '../types';

/** Шаги экземпляра: снимок при запуске или шаблон процесса */
export function getStepsForInstance(process: BusinessProcess, instance: ProcessInstance): ProcessStep[] {
  if (instance.dynamicSteps?.length) return instance.dynamicSteps;
  return process.steps || [];
}

/** Строит шаги процесса из этапов воронки (id шага = id этапа воронки) */
export function buildDynamicStepsFromFunnel(deal: Deal, funnel: SalesFunnel): ProcessStep[] {
  return (funnel.stages || []).map((st, i) => ({
    id: st.id,
    title: st.label,
    description: `Этап воронки «${funnel.name}»`,
    assigneeType: 'user' as const,
    assigneeId: deal.assigneeId,
    order: i,
  }));
}
