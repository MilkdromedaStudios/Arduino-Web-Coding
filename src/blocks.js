export const blockDefinitions=[
 {type:'robot_start',message0:'when Arduino starts',message1:'forever %1',args1:[{type:'input_statement',name:'DO'}],colour:'#ffbf00'},
 {type:'pin_mode',message0:'set pin %1 mode %2',args0:[{type:'field_number',name:'PIN',value:13,min:0,max:99},{type:'field_dropdown',name:'MODE',options:[['output','OUTPUT'],['input','INPUT'],['input pull-up','INPUT_PULLUP']]}],previousStatement:null,nextStatement:null,colour:'#4c97ff'},
 {type:'digital_write',message0:'set digital pin %1 %2',args0:[{type:'field_number',name:'PIN',value:13,min:0,max:99},{type:'field_dropdown',name:'STATE',options:[['high','HIGH'],['low','LOW']]}],previousStatement:null,nextStatement:null,colour:'#4c97ff'},
 {type:'analog_write',message0:'set PWM pin %1 to %2',args0:[{type:'field_number',name:'PIN',value:9,min:0,max:99},{type:'field_number',name:'VALUE',value:128,min:0,max:255}],previousStatement:null,nextStatement:null,colour:'#9966ff'},
 {type:'wait_ms',message0:'wait %1 milliseconds',args0:[{type:'field_number',name:'MS',value:1000,min:0}],previousStatement:null,nextStatement:null,colour:'#ffab19'},
 {type:'serial_print',message0:'say %1 in serial',args0:[{type:'field_input',name:'TEXT',text:'Hello robot!'}],previousStatement:null,nextStatement:null,colour:'#0fbd8c'}
];
export const toolbox={kind:'categoryToolbox',contents:[
 {kind:'category',name:'Events',colour:'#ffbf00',contents:[{kind:'block',type:'robot_start'}]},
 {kind:'category',name:'Pins',colour:'#4c97ff',contents:[{kind:'block',type:'pin_mode'},{kind:'block',type:'digital_write'}]},
 {kind:'category',name:'Motors',colour:'#9966ff',contents:[{kind:'block',type:'analog_write'}]},
 {kind:'category',name:'Control',colour:'#ffab19',contents:[{kind:'block',type:'wait_ms'}]},
 {kind:'category',name:'Serial',colour:'#0fbd8c',contents:[{kind:'block',type:'serial_print'}]}
]};
