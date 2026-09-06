/* global jest */
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

jest.mock('react-native-reanimated', () => {
  const RN = require('react-native');

  class MockBaseAnimation {
    duration() { return this; }
    delay() { return this; }
    springify() { return this; }
    damping() { return this; }
    stiffness() { return this; }
    withCallback() { return this; }
    randomDelay() { return this; }
    withInitialValues() { return this; }
    easing() { return this; }
    rotate() { return this; }
    mass() { return this; }
    restDisplacementThreshold() { return this; }
    restSpeedThreshold() { return this; }
    overshootClamping() { return this; }
    dampingRatio() { return this; }
    build() { return () => ({ initialValues: {}, animations: {} }); }
    reduceMotion() { return this; }
  }

  const noop = () => {};
  const id = (t) => t;

  const mockEasing = {
    linear: id,
    ease: id,
    quad: id,
    cubic: id,
    poly: () => id,
    sin: id,
    circle: id,
    exp: id,
    elastic: () => id,
    back: () => id,
    bounce: id,
    bezier: () => id,
    in: (fn) => fn || id,
    out: (fn) => fn || id,
    inOut: (fn) => fn || id,
  };

  const reanimated = {
    __esModule: true,
    default: {
      View: RN.View,
      Text: RN.Text,
      Image: RN.Image,
      ScrollView: RN.ScrollView,
      FlatList: RN.FlatList,
      createAnimatedComponent: id,
    },
    View: RN.View,
    Text: RN.Text,
    Image: RN.Image,
    ScrollView: RN.ScrollView,
    FlatList: RN.FlatList,
    Easing: mockEasing,
    useSharedValue: (init) => ({ value: init }),
    useAnimatedStyle: (fn) => (typeof fn === 'function' ? fn() : {}),
    useDerivedValue: (fn) => ({ value: typeof fn === 'function' ? fn() : fn }),
    useAnimatedRef: () => ({ current: null }),
    withTiming: (toValue, _, cb) => { cb?.(true); return toValue; },
    withSpring: (toValue, _, cb) => { cb?.(true); return toValue; },
    withSequence: (...anims) => anims[anims.length - 1],
    withDelay: (_, anim) => anim,
    withRepeat: (anim) => anim,
    runOnJS: (fn) => fn,
    runOnUI: (fn) => fn,
    cancelAnimation: noop,
    makeMutable: id,
  };

  return new Proxy(reanimated, {
    get(target, prop) {
      if (prop in target) {
        return target[prop];
      }
      // If it looks like an animation (Capitalized), return a MockBaseAnimation
      if (typeof prop === 'string' && /^[A-Z]/.test(prop)) {
        return new MockBaseAnimation();
      }
      return undefined;
    },
  });
});
