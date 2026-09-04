import {
  addDoc as firebaseAddDoc,
  collection,
  deleteDoc as firebaseDeleteDoc,
  deleteField,
  doc,
  getDoc as firebaseGetDoc,
  getDocs as firebaseGetDocs,
  onSnapshot as firebaseOnSnapshot,
  query,
  runTransaction as firebaseRunTransaction,
  serverTimestamp,
  setDoc as firebaseSetDoc,
  updateDoc as firebaseUpdateDoc,
  where,
  writeBatch as firebaseWriteBatch
} from 'https://www.gstatic.com/firebasejs/12.7.0/firebase-firestore.js';
import {
  beginDatabaseActivity,
  finishDatabaseActivityAfterPaint,
  trackDatabaseOperation
} from './database-activity-v94.js?v=94';

export { collection, deleteField, doc, query, serverTimestamp, where };

const LOAD_MESSAGE = 'Carregando informações...';
const SAVE_MESSAGE = 'Salvando e atualizando informações...';

export const getDoc = (...args) => trackDatabaseOperation(
  () => firebaseGetDoc(...args),
  LOAD_MESSAGE
);

export const getDocs = (...args) => trackDatabaseOperation(
  () => firebaseGetDocs(...args),
  LOAD_MESSAGE
);

export const addDoc = (...args) => trackDatabaseOperation(
  () => firebaseAddDoc(...args),
  SAVE_MESSAGE
);

export const setDoc = (...args) => trackDatabaseOperation(
  () => firebaseSetDoc(...args),
  SAVE_MESSAGE
);

export const updateDoc = (...args) => trackDatabaseOperation(
  () => firebaseUpdateDoc(...args),
  SAVE_MESSAGE
);

export const deleteDoc = (...args) => trackDatabaseOperation(
  () => firebaseDeleteDoc(...args),
  SAVE_MESSAGE
);

export const runTransaction = (...args) => trackDatabaseOperation(
  () => firebaseRunTransaction(...args),
  SAVE_MESSAGE
);

const wrapBatch = batch => {
  let proxy;
  proxy = new Proxy(batch, {
    get(target, property) {
      if (property === 'commit') {
        return (...args) => trackDatabaseOperation(
          () => target.commit(...args),
          SAVE_MESSAGE
        );
      }
      const value = Reflect.get(target, property, target);
      if (typeof value !== 'function') return value;
      return (...args) => {
        const result = value.apply(target, args);
        return result === target ? proxy : result;
      };
    }
  });
  return proxy;
};

export const writeBatch = (...args) => wrapBatch(firebaseWriteBatch(...args));

export const onSnapshot = (reference, ...args) => {
  const finish = beginDatabaseActivity(LOAD_MESSAGE);
  let finished = false;
  const finishOnce = () => {
    if (finished) return;
    finished = true;
    void finishDatabaseActivityAfterPaint(finish);
  };
  const wrappedArgs = [...args];
  const observerIndex = wrappedArgs.findIndex(value => value && typeof value === 'object' && typeof value.next === 'function');

  if (observerIndex >= 0) {
    const observer = wrappedArgs[observerIndex];
    wrappedArgs[observerIndex] = {
      ...observer,
      next: (...values) => {
        finishOnce();
        return observer.next.call(observer, ...values);
      },
      error: (...values) => {
        finishOnce();
        return observer.error?.call(observer, ...values);
      }
    };
  } else {
    const nextIndex = wrappedArgs.findIndex(value => typeof value === 'function');
    if (nextIndex >= 0) {
      const next = wrappedArgs[nextIndex];
      wrappedArgs[nextIndex] = (...values) => {
        finishOnce();
        return next(...values);
      };
      const errorIndex = wrappedArgs.findIndex((value, index) => index > nextIndex && typeof value === 'function');
      if (errorIndex >= 0) {
        const error = wrappedArgs[errorIndex];
        wrappedArgs[errorIndex] = (...values) => {
          finishOnce();
          return error(...values);
        };
      }
    }
  }

  try {
    const unsubscribe = firebaseOnSnapshot(reference, ...wrappedArgs);
    return () => {
      finishOnce();
      unsubscribe();
    };
  } catch (error) {
    finish();
    throw error;
  }
};
