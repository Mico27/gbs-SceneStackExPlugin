export const id = "EVENT_GET_SCENE_STACK_EX_COUNT";
export const name = "Get scene stack ex count";
export const groups = ["Stack extended"];

export const autoLabel = (fetchArg) => {
    return `Get scene stack ex count`;
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
    
    const { _getMemUInt8, getVariableAlias } = helpers;    
    const variableAlias = getVariableAlias(input.output);
    _getMemUInt8(variableAlias, "scene_stack_ex_count");    
};
