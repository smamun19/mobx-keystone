import { action, observable } from "mobx"
import { Model } from "../model/Model"
import { attachToRootStore, detachFromRootStore } from "../rootStore/attachDetach"
import { isRootStore } from "../rootStore/rootStore"
import { isTweakedObject } from "../tweaker/core"
import { failure, inDevMode, isPrimitive } from "../utils"
import {
  getRootIdCache,
  objectChildren,
  objectParents,
  parentPathEquals,
  reportParentPathChanged,
} from "./core"
import { getParentPath, getRoot, ParentPath } from "./path"

/**
 * @ignore
 */
export const setParent = action(
  "setParent",
  (value: any, parentPath: ParentPath<any> | undefined): void => {
    if (isPrimitive(value)) {
      return
    }

    if (inDevMode()) {
      if (typeof value === "function" || typeof value === "symbol") {
        throw failure(`assertion failed: value cannot be a function or a symbol`)
      }
      if (!isTweakedObject(value)) {
        throw failure(`assertion failed: value is not ready to take a parent`)
      }
      if (parentPath) {
        if (!isTweakedObject(parentPath.parent)) {
          throw failure(`assertion failed: parent is not ready to take children`)
        }
      }
    }

    if (!objectChildren.has(value)) {
      objectChildren.set(value, observable.set())
    }

    const oldParentPath = getParentPath(value)
    if (parentPathEquals(oldParentPath, parentPath)) {
      return
    }

    if (isRootStore(value)) {
      throw failure("root stores cannot be attached to any parents")
    }

    if (oldParentPath && parentPath) {
      throw failure("an object cannot be assigned a new parent when it already has one")
    }

    const removeFromOldParent = () => {
      if (oldParentPath && oldParentPath.parent) {
        const children = objectChildren.get(oldParentPath.parent)!
        children.delete(value)
      }
    }

    const attachToNewParent = () => {
      if (parentPath && parentPath.parent) {
        const children = objectChildren.get(parentPath.parent)!
        children.add(value)
      }
      objectParents.set(value, parentPath)
    }

    if (value instanceof Model) {
      const oldRoot = getRoot(value)
      const oldRootStore = isRootStore(oldRoot) ? oldRoot : undefined
      removeFromOldParent()

      attachToNewParent()
      const newRoot = getRoot(value)
      const newRootStore = isRootStore(newRoot) ? newRoot : undefined

      // update id caches
      const modelId = value.modelId
      if (oldRoot !== newRoot) {
        getRootIdCache(oldRoot).delete(modelId)
      }
      getRootIdCache(newRoot).set(modelId, value)

      // invoke model root store events
      if (oldRootStore !== newRootStore) {
        if (oldRootStore) {
          detachFromRootStore(value)
        }
        if (newRootStore) {
          attachToRootStore(newRootStore, value)
        }
      }
    } else {
      removeFromOldParent()
      attachToNewParent()
    }

    reportParentPathChanged(value)
  }
)