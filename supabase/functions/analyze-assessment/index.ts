import { handleAssessmentRequest } from '../_shared/assessment-handler.ts';

Deno.serve((request) => handleAssessmentRequest(request));
