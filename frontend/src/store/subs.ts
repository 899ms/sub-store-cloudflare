import { useCloudflareApi } from '@/api/app';
import i18n from '@/locales';
import { useAppNotifyStore } from '@/store/appNotify';
import { getFlowsUrlList } from '@/utils/getFlowsUrlList';
import { isAbortError, runFrontendRequestTask } from '@/utils/requestConcurrency';
import { defineStore } from 'pinia';

const { t } = i18n.global;
const cloudflareApi = useCloudflareApi();

const fetchFlowsAbortControllers = new Set<AbortController>();
const fetchFlowAbortControllers = new Map<string, AbortController>();
const latestFlowRequestVersions = new Map<string, number>();
let flowRequestSequence = 0;

const canFetchFlowsForCurrentPage = () => window.location.pathname === '/subs';

const createFlowRequestState = (flowKey: string, parentSignal: AbortSignal) => {
  fetchFlowAbortControllers.get(flowKey)?.abort();

  const version = ++flowRequestSequence;
  const abortController = new AbortController();
  const abortCurrentFlow = () => abortController.abort();

  fetchFlowAbortControllers.set(flowKey, abortController);
  latestFlowRequestVersions.set(flowKey, version);

  if (parentSignal.aborted) {
    abortController.abort();
  } else {
    parentSignal.addEventListener('abort', abortCurrentFlow, { once: true });
  }

  return {
    signal: abortController.signal,
    version,
    clear: () => {
      parentSignal.removeEventListener('abort', abortCurrentFlow);
      if (fetchFlowAbortControllers.get(flowKey) === abortController) {
        fetchFlowAbortControllers.delete(flowKey);
      }
      clearFlowRequestVersion(flowKey, version);
    },
  };
};

const isLatestFlowRequest = (flowKey: string, version: number, signal?: AbortSignal) => {
  return !signal?.aborted && latestFlowRequestVersions.get(flowKey) === version;
};

const clearFlowRequestVersion = (flowKey: string, version: number) => {
  if (latestFlowRequestVersions.get(flowKey) === version) {
    latestFlowRequestVersions.delete(flowKey);
  }
};

type FetchFlowsOptions = {
  cancelPrevious?: boolean;
  missingOnly?: boolean;
  priority?: number;
};

// class TaskProcessor {
//   #fulfilledIndexes; // 已完成任务的索引集合
//   #results; // 所有任务的执行结果
//   #shouldStopAll; //停止所有任务
//   #stopCount; //已停止任务的数量

//   /**
//    * 状态初始化函数
//    * @private
//    */

//   #initializeState() {
//     this.#fulfilledIndexes = new Set();
//     this.#results = [];
//     this.#shouldStopAll = false;
//     this.#stopCount = 0;
//   }

//   /**
//    * 停止所有任务
//    * @param {string} [message]
//    */
//   stopAll(message = "") {
//     this.#shouldStopAll = true;
//     throw new Error(message);
//   }

//   /**
//    * 停止单个任务
//    * @param {string} [message]
//    */
//   stop(message = "") {
//     this.#stopCount++;
//     throw new Error(message);
//   }

//   /**
//    * 创建延时Promise
//    * @param {number} seconds - 延时秒数
//    * @returns {Promise<void>}
//    */
//   #delay(seconds) {
//     return seconds
//       ? new Promise((resolve) => setTimeout(resolve, seconds * 1000))
//       : Promise.resolve();
//   }

//   /**
//    * 检查值是否为Promise
//    * @param {any} value
//    * @returns {boolean}
//    */
//   #isPromise(value) {
//     return Boolean(value && typeof value.then === "function");
//   }

//   /**
//    * 任务标准化
//    * @param {Function|Promise|any} task
//    * @returns {Function}
//    */
//   #normalizeTask(task) {
//     if (this.#isPromise(task)) return task;
//     if (typeof task === "function") return task;
//     return () => task;
//   }

//   /**
//    * 处理Promise数组，分类收集成功和失败结果
//    * @param {Array<Promise>} promiseArray - Promise数组
//    * @returns {Promise<{resolve?: Array, reject?: Array}>}
//    */
//   async #resolvePromises(promiseArray) {
//     const reject = [];
//     const resolve = [];

//     for (const promise of promiseArray) {
//       try {
//         resolve.push(await promise);
//       } catch (error) {
//         reject.push(error);
//       }
//     }

//     if (resolve.length && !reject.length) return { resolve };
//     if (reject.length && !resolve.length) return { reject };
//     return { resolve, reject };
//   }

//   /**
//    * 执行限制并发数的任务组
//    * @param {Array} tasks - 任务数组
//    * @param {number} concurrencyLimit - 并发限制
//    * @returns {Promise<boolean>} 是否所有任务都已完成
//    */
//   async #executeTasksWithLimit(tasks, concurrencyLimit) {
//     const executing = new Set();

//     for (let i = 0; i < tasks.length; i++) {
//       // 检查是否需要中断所有任务处理
//       if (this.#shouldStopAll) return false;
//       // 如果该任务已完成，继续下一个任务
//       if (this.#fulfilledIndexes.has(i)) continue;

//       const task = tasks[i];
//       const p = this.#isPromise(task) ? task : Promise.resolve().then(task);
//       this.#results[i] = p;

//       const e = p.then(() => {
//         executing.delete(e);
//         this.#fulfilledIndexes.add(i);
//       });

//       executing.add(e);

//       console.log('并发数', executing.size)

//       executing.size >= concurrencyLimit &&
//         (await Promise.race(executing).catch(() => {}));
//     }

//     await Promise.allSettled(this.#results);
//     return this.#fulfilledIndexes.size + this.#stopCount >= tasks.length;
//   }

//   /**
//    * 处理并发任务的主函数
//    * @param {Array} tasks - 任务数组
//    * @param {number} [concurrencyLimit=10] - 并发限制
//    * @param {number} [maxRetry=2] - 最大重试次数
//    * @param {number} [waitTime=0] - 重试等待时间(秒)
//    * @returns {Promise<{resolve?: Array, reject?: Array}>}
//    */
//   async runTasks({ tasks = [], concurrencyLimit = 10, maxRetry = 2, waitTime = 0 }) {
//     this.#initializeState();
//     tasks = tasks.map(this.#normalizeTask, this);

//     while (maxRetry-- && !this.#shouldStopAll) {
//       const isFulfilled = await this.#executeTasksWithLimit(tasks, concurrencyLimit);
//       if (isFulfilled) break;
//       maxRetry && (await this.#delay(waitTime));
//     }

//     return this.#resolvePromises(this.#results);
//   }
// }
export const useSubsStore = defineStore('subsStore', {
  state: (): SubsStoreState => {
    return {
      subs: [],
      collections: [],
      flows: {},
    };
  },
  getters: {
    hasSubs: ({ subs }): boolean => subs.length > 0,
    hasCollections: ({ collections }): boolean => collections.length > 0,
    getOneSub:
      ({ subs }): GetOne<Sub> =>
      (name: string) =>
        subs.find(sub => sub.name === name),
    getOneCollection:
      ({ collections }): GetOne<Collection> =>
      (name: string): Collection =>
        collections.find(collection => collection.name === name),
  },
  actions: {
    async fetchSubsData() {
      await Promise.allSettled([
        runFrontendRequestTask(async () => {
          const res = await cloudflareApi.getSources();
          if ('data' in res.data) {
            this.subs = res.data.data.map(i => {
              if (!Array.isArray(i.tag)) {
                i.tag = []
              }
              return i
            });
          }
        }, 'subs.getSubs'),
        runFrontendRequestTask(async () => {
          const res = await cloudflareApi.getCollections();
          if ('data' in res.data) {
            this.collections = res.data.data.map(i => {
              if (!Array.isArray(i.tag)) {
                i.tag = []
              }
              return i
            });
          }
        }, 'subs.getCollections'),
      ]);
    },
    setOneData(type: string, name: string, data: any) {
      const index = this[type].findIndex(item => item.name === name);
      if (index !== -1) {
        this[type][index] = data;
      }
    },
    async updateOneData(type: string, name: string) {
      try {
        let res;
        if (type === 'subs') {
          res = await cloudflareApi.getOne('sub', name);
        } else if (type === 'collections') {
          res = await cloudflareApi.getOne('collection', name);
        }
        if (res?.data?.status === 'success') {
          const index = this[type].findIndex(item => item.name === name);
          this[type][index] = res.data.data;
        } 
      } catch (error) {
        console.log('updateOneData error', error);
      }
    },
    cancelFetchFlows() {
      if (
        fetchFlowsAbortControllers.size === 0
        && fetchFlowAbortControllers.size === 0
        && latestFlowRequestVersions.size === 0
      ) return;

      fetchFlowsAbortControllers.forEach(controller => controller.abort());
      fetchFlowsAbortControllers.clear();
      fetchFlowAbortControllers.forEach(controller => controller.abort());
      fetchFlowAbortControllers.clear();
      latestFlowRequestVersions.clear();
      console.log('[frontend-request-concurrency] cancel fetchFlows');
    },
    async fetchFlows(sub?: Sub[], options: FetchFlowsOptions = {}) {
      type FlowUrlItem = [string, string, boolean, boolean, boolean];
      if (!canFetchFlowsForCurrentPage()) {
        this.cancelFetchFlows();
        console.log('[frontend-request-concurrency] skip fetchFlows outside /subs');
        return;
      }

      const isTargetedFetch = Boolean(sub);
      const {
        cancelPrevious = !isTargetedFetch,
        missingOnly = false,
        priority = isTargetedFetch ? 100 : 0,
      } = options;

      if (cancelPrevious) {
        this.cancelFetchFlows();
      }

      const abortController = new AbortController();
      fetchFlowsAbortControllers.add(abortController);
      const { signal } = abortController;

      const asyncGetFlow = async (
        [url, name, noFlow, hideExpire, showRemaining],
        index,
        requestVersion: number,
        requestSignal: AbortSignal,
        clearRequest: () => void,
      ) => {
        console.log(`[START] ${index} ${url}fetching flow`)
        try {
          if (!isLatestFlowRequest(url, requestVersion, requestSignal)) {
            console.log(`[SKIP] ${index} ${url} stale flow`)
            return;
          }

          if (noFlow) {
            this.flows[url] = { status:'noFlow' };
          } else {
            const res = await cloudflareApi.getFlow(name, requestSignal);
            if (!isLatestFlowRequest(url, requestVersion, requestSignal)) {
              console.log(`[SKIP] ${index} ${url} stale flow`)
              return;
            }

            const data = res?.data;
            if (data) {
              this.flows[url] = {...data, hideExpire, showRemaining };
            }
          }
        } catch (e) {
          if (isAbortError(e) || requestSignal.aborted) {
            throw e;
          }
        } finally {
          clearRequest();
          console.log(`[END] ${index} ${url} fetching flow`)
        }
      };
      // const subs = sub || this.subs;
      // getFlowsUrlList(subs).forEach(asyncGetFlow);
      // 多次反复开启 容易爆内存 尝试分批请求 3/100ms
      const flowsUrlList = (getFlowsUrlList(sub || this.subs) as FlowUrlItem[])
        .filter(([url]) => !missingOnly || !(url in this.flows));
      // const processor = new TaskProcessor();
      // await processor.runTasks({
      //   tasks: flowsUrlList.map((item, index) => async() => {
      //     await asyncGetFlow(item, index);
      //   }),
      //   concurrencyLimit: 3,
      //   maxRetry: 1,
      //   waitTime: 0,
      // });

      const flowTasks = [] as Array<{ label: string; signal: AbortSignal; task: () => Promise<void> }>;

      flowsUrlList.forEach((item, index) => {
        const [url, , noFlow] = item;
        const requestState = createFlowRequestState(url, signal);
        if (noFlow) {
          if (isLatestFlowRequest(url, requestState.version, requestState.signal)) {
            this.flows[url] = { status:'noFlow' };
          }
          requestState.clear();
          return;
        }
        flowTasks.push({
          label: `subs.getFlow:${item[1]}`,
          signal: requestState.signal,
          task: () => asyncGetFlow(
            item,
            index,
            requestState.version,
            requestState.signal,
            requestState.clear,
          ),
        });
      });

      try {
        await Promise.all(flowTasks.map(({ label, signal: flowSignal, task }) => (
          runFrontendRequestTask(task, label, { priority, signal: flowSignal })
            .catch((error) => {
              if (!isAbortError(error) && !flowSignal.aborted) {
                throw error;
              }
            })
        )))
      } catch (error) {
        if (!isAbortError(error) && !signal.aborted) {
          throw error;
        }
      } finally {
        fetchFlowsAbortControllers.delete(abortController);
      }
  
      // const batches = [];

      // for (let i = 0; i < flowsUrlList.length; i += 4) {
      //   const batch = flowsUrlList.slice(i, i + 4);
      //   batches.push(batch);
      // }

      // for (const batch of batches) {
      //   const promises = batch.map(asyncGetFlow);
      //   await Promise.all(promises);
      //   // await new Promise((resolve) => setTimeout(resolve, 150));
      // }
    },
    async deleteItem(
      type: SubsType,
      name: string,
      mode?: DeleteMode,
      isShowNotify: boolean = true,
    ) {
      try {
        const { showNotify } = useAppNotifyStore();

        const { data } = await cloudflareApi.deleteItem(type, name, mode);
        if (data.status === 'success') {
          await this.fetchSubsData();
          isShowNotify && showNotify({
            type: 'danger',
            title: t('subPage.deleteItem.succeedNotify'),
          });
          return true;
        }
      } catch (error) {
        console.log('deleteItem error', error);
      }

      return false;
    },
  },
});
