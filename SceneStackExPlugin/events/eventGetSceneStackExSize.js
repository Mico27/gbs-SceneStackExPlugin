export const id = "EVENT_GET_SCENE_STACK_EX_SIZE";
export const name = "Get scene stack ex size";
export const groups = ["Stack extended"];

export const autoLabel = (fetchArg) => {
    return `Get scene stack ex size`;
};

export const fields = [
  {
  	key: "output",
  	label: "Variable",
  	type: "variable",
  	defaultValue: "LAST_VARIABLE",
  },
    
];

export const compile = (input, helpers) => {
    
    const { getVariableAlias, _callNative, _stackPushConst, _stackPop } = helpers;    
    const variableAlias = getVariableAlias(input.output);
    _stackPushConst(variableAlias);  
    _callNative("vm_get_stack_size");
    _stackPop(1);
};
