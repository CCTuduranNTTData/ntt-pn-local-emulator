import { flow } from 'fp-ts/lib/function';
import * as O from 'fp-ts/Option';
import * as E from 'fp-ts/Either';
import * as RA from 'fp-ts/ReadonlyArray';
import { ApiKey } from '../generated/definitions/ApiKey';
import { ProgressResponse } from '../generated/streams/ProgressResponse';
import { NewStatusEnum, ProgressResponseElement } from '../generated/streams/ProgressResponseElement';
import { NotificationRequest } from './NotificationRequest';
import { Notification } from './Notification';
import { Repository } from './Repository';
import { Response, UnauthorizedMessageBody } from './types';

export type ConsumeEventStreamRecord = {
  type: 'ConsumeEventStreamRecord';
  input: { apiKey: ApiKey; streamId: string; lastEventId?: string };
  output: Response<200, ProgressResponse> | Response<403, UnauthorizedMessageBody> | Response<419>;
};

const getProgressResponse = (record: ConsumeEventStreamRecord): O.Option<ProgressResponse> =>
  record.output.statusCode === 200 ? O.some(record.output.returned) : O.none;

export const getProgressResponseList = flow(RA.filterMap(getProgressResponse), RA.flatten);

export const makeProgressResponse = (timestamp: Date) =>
  RA.map(
    E.fold(
      makeProgressResponseElementFromNotificationRequest(timestamp),
      makeProgressResponseElementFromNotification(timestamp)
    )
  );

const makeProgressResponseElementFromNotification =
  (timestamp: Date) =>
  (notification: Notification): ProgressResponseElement => ({
    ...makeProgressResponseElementFromNotificationRequest(timestamp)(notification),
    iun: notification.iun,
    newStatus: NewStatusEnum.ACCEPTED,
  });

const makeProgressResponseElementFromNotificationRequest =
  (timestamp: Date) =>
  (notificationRequest: NotificationRequest): ProgressResponseElement => ({
    eventId: '0',
    timestamp,
    notificationRequestId: notificationRequest.notificationRequestId,
  });

export type ConsumeEventStreamRecordRepository = Repository<ConsumeEventStreamRecord>;