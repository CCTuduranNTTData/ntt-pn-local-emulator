import { pipe } from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';
import { IUN } from '../generated/pnapi/IUN';
import { NotificationAttachmentDownloadMetadataResponse } from '../generated/pnapi/NotificationAttachmentDownloadMetadataResponse';
import { NotificationPaymentAttachment } from '../generated/pnapi/NotificationPaymentAttachment';
import { Problem } from '../generated/pnapi/Problem';
import { NotificationPaymentItem } from '../generated/pnapi/NotificationPaymentItem';
import { authorizeApiKey } from './authorize';
import { DomainEnv } from './DomainEnv';
import { AuditRecord, Record } from './Repository';
import { computeSnapshot } from './Snapshot';
import { notFoundResponse, Response, UnauthorizedMessageBody } from './types';
import { makeNotificationAttachmentDownloadMetadataResponse } from './NotificationAttachmentDownloadMetadataResponse';

export type GetPaymentNotificationMetadataRecord = AuditRecord & {
  type: 'GetPaymentNotificationMetadataRecord';
  input: { apiKey: string; iun: IUN; recipientId: number; attachmentName: string };
  output:
    | Response<200, NotificationAttachmentDownloadMetadataResponse>
    | Response<403, UnauthorizedMessageBody>
    | Response<404, Problem>;
};

export const isGetPaymentNotificationMetadataRecord = (
  record: Record
): O.Option<GetPaymentNotificationMetadataRecord> =>
  record.type === 'GetPaymentNotificationMetadataRecord' ? O.some(record) : O.none;

// FIXME: The attachmentName type should be an enum -> check type generated by openapi
const getNotificationPaymentAttachment =
  (attachmentName: string) =>
  (payment: NotificationPaymentItem): O.Option<NotificationPaymentAttachment> => {
    // eslint-disable-next-line sonarjs/no-small-switch
    switch (attachmentName) {
      case 'PAGOPA':
        return O.fromNullable(payment.pagoPa?.attachment);
      case 'F24':
        return O.fromNullable(payment.f24?.metadataAttachment);
      default:
        return O.none;
    }
  };

export const makeGetPaymentNotificationMetadataRecord =
  (env: DomainEnv) =>
  (input: GetPaymentNotificationMetadataRecord['input']) =>
  (records: ReadonlyArray<Record>): GetPaymentNotificationMetadataRecord => ({
    type: 'GetPaymentNotificationMetadataRecord',
    input,
    loggedAt: env.dateGenerator(),
    output: pipe(
      authorizeApiKey(input.apiKey),
      E.map(() =>
        pipe(
          computeSnapshot(env)(records),
          RA.filterMap(O.fromEither),
          // Per il momento solo il tipo PAGOPA è gestito. In caso di valori differenti si restituisce 404.
          RA.filter((notification) => notification.iun && input.attachmentName === 'PAGOPA'),
          // Si verifica che il recipientId è coerente e presente negli array dei recipients. In caso contrario restituiamo 404.
          RA.filter((notification) => input.recipientId >= 0 && notification.recipients.length > input.recipientId),
          RA.chain((notification) => (notification.iun === input.iun ? [notification.recipients[input.recipientId]] : RA.empty)),
          RA.filterMap((recipient) => O.fromNullable(recipient.payments)),
          RA.findLastMap(getNotificationPaymentAttachment(input.attachmentName)),
          O.map(makeNotificationAttachmentDownloadMetadataResponse(env)),
          O.map((paymentAttachment) => ({ statusCode: 200 as const, returned: paymentAttachment })),
          O.getOrElseW(() => notFoundResponse('PN_DELIVERY_FILEINFONOTFOUND'))
        )
      ),
      E.toUnion
    ),
  });
