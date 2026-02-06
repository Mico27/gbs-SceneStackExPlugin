export const id = "EVENT_PUSH_SCENE_STACK_EX";
export const name = "Push scene stack ex";
export const groups = ["Stack extended"];

export const autoLabel = (fetchArg) => {
    return `Push scene stack ex`;
};

export const fields = [
    {
        label: "Push scene to stack",
    },
    {
        key: "__scriptTabs",
        type: "tabs",
        defaultValue: "push",
        values: {
            push: "On push",
            pop: "On pop",
        },
    },
    {
        key: "push",
        label: "On push",
        description: "On push",
        type: "events",
        conditions: [
            {
                key: `__scriptTabs`,
                ne: "pop",
            },
        ],
    },
    {
        key: "pop",
        label: "On pop",
        description: "On pop",
        type: "events",
        conditions: [
            {
                key: `__scriptTabs`,
                eq: "pop",
            },
        ],
    },
    
];

export const compile = (input, helpers) => {
    
    const { _callNative, _stackPushConst, _addComment, _fadeIn, _ifConst, _compilePath, _declareLocal, getNextLabel, _addNL, _jump, _label, _stackPop } = helpers;
    
    const hasPoppedRef = _declareLocal("has_popped", 1, true);
    const popLabel = getNextLabel();
    const endLabel = getNextLabel();
    _addComment(`Push scene stack`);        
    _callNative("vm_push_scene_stack_ex");    
    _stackPushConst(hasPoppedRef);
    _callNative("vm_poll_stack_pop");
    _stackPop(1);    
    _ifConst(".EQ", hasPoppedRef, 1, popLabel, 0);
    _addNL();
    _compilePath(input.push);
    _jump(endLabel);
    _label(popLabel);
    _compilePath(input.pop);
    if (!Array.isArray(input.pop)) {
        _fadeIn(true);
    }
    _label(endLabel);
    
    _addNL();
};
