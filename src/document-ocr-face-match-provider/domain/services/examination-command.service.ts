import { ExaminationId } from "../model/valueobjects/examination-id.value-object.js";
import { ConsumeExaminationMatchCommand } from "../model/commands/consume-examination-match.command.js";
import { RequestDocumentExaminationCommand } from "../model/commands/request-document-examination.command.js";
import { RequestDocumentReexaminationCommand } from "../model/commands/request-document-reexamination.command.js";
import { ExamineDocumentExaminationCommand } from "../model/commands/examine-document-examination.command.js";
import { ExpireDocumentExaminationCommand } from "../model/commands/expire-document-examination.command.js";

/**
 * Domain port for examination writes. One method per command,
 * `methodName = lowerCamel(ClassName without Command)`, receiving the
 * command object. Implementations live in application and hold no rules.
 */
export interface ExaminationCommandService {
  requestDocumentExamination(command: RequestDocumentExaminationCommand): Promise<ExaminationId>;
  requestDocumentReexamination(command: RequestDocumentReexaminationCommand): Promise<ExaminationId>;
  examineDocumentExamination(command: ExamineDocumentExaminationCommand): Promise<void>;
  expireDocumentExamination(command: ExpireDocumentExaminationCommand): Promise<void>;
  consumeExaminationMatch(command: ConsumeExaminationMatchCommand): Promise<boolean>;
}
export const EXAMINATION_COMMAND_SERVICE = Symbol('EXAMINATION_COMMAND_SERVICE');
