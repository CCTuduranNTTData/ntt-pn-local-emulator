import express from 'express';
import { pipe } from 'fp-ts/lib/function';
import * as E from 'fp-ts/Either';
import * as T from 'fp-ts/Task';
import * as TE from 'fp-ts/TaskEither';
import * as Problem from '../Problem';
import { GetChecklistResultUseCase } from '../../../useCases/GetChecklistResultUseCase';
import { Handler, toExpressHandler } from '../Handler';
import * as codec from './codec';

const getChecklistResultHandler =
  (getChecklistResultUseCase: GetChecklistResultUseCase): Handler =>
  (_, res) =>
    pipe(
      E.of(getChecklistResultUseCase()),
      E.map(
        TE.fold(
          (_) => T.of(res.status(500).send(Problem.fromNumber(500))),
          (result) => T.of(res.status(200).send(codec.makeChecklistResult(result)))
        )
      )
    );

export const makeChecklistRouter = (getChecklistResultUseCase: GetChecklistResultUseCase): express.Router => {
  const router = express.Router();

  router.get('/checklistresult', toExpressHandler(getChecklistResultHandler(getChecklistResultUseCase)));

  return router;
};