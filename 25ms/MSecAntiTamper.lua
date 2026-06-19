local funnydumpsrc=[[
local print=print
local env = getfenv()
local insert=table.insert
local function debug_getinfo(func_or_level)
    local info = {}
    local function getinfo_opt(opt, name)
        local value = debug.info(func_or_level, opt)
        if value ~= nil then
            info[name] = value
        end
    end

    getinfo_opt("l", "linedefined")      -- Line defined
    getinfo_opt("f", "func")              -- Function reference
    -- getinfo_opt("u", "nups")             -- Number of upvalues
    -- getinfo_opt("c", "currentline")      -- Current line
    -- getinfo_opt("p", "nparams")          -- Number of parameters
    -- getinfo_opt("t", "ntransfer")        -- Number of transfer values
    -- getinfo_opt("v", "isvararg")         -- Is variadic
    getinfo_opt("s", "source")           -- Source
    getinfo_opt("n", "namewhat")         -- Name category
    getinfo_opt("l", "istailcall")       -- Is tail call
    getinfo_opt("s", "short_src")        -- Short source
    info.what=info.short_src:gsub("%[(.+)%]","%1")
    -- getinfo_opt("x", "ftransfer")        -- First transfer
    -- getinfo_opt("L", "lastlinedefined")  -- Last line defined
    -- print(info)
    insert(debugresults,info)
    return info
end
local _unpack = unpack
local unpackfound
local function myunpack(...)
    _25ms(...) -- inst method
    return _unpack(...)
end
local _debug={}
local x=0
local _table=table
local mytable=setmetatable({concat=function(...)
    local res=_table.concat(...)
    local expression="(%a%w?%w?)%[(%a%w?%w?)%]%s*=%s*(%a%w?%w?)[;%s]"
    -- if res:find(expression) then res=res:gsub(expression,"_25ms(%3);%1[%2] = %3;") end -- constant method
    return res
end},{__index=_table})
table=mytable
table.foreach(debug,function(i,v)_debug[i]=v end)
setmetatable(_debug,{__index={getinfo=debug_getinfo}})
function getfenv()
    return setmetatable({},{
        __index=function(_,key)
            print(key)
            if key=="debug" then
                return _debug
            elseif key=="loadstring" then
                if x<7 then
                    x+=1
                    return loadstring
                end
                return function(src,b)
                    -- print(src)
                    return loadstring(src,b)
                end-- change to print to be sigma
            elseif key=="table" then
                return mytable
            elseif key=="unpack" then
                if not unpackfound then
                    unpackfound=true
                    return _unpack
                end
                return myunpack
            elseif key=="require" or key=="game"then
                return error()
            end
            return env[key]
        end
    })
end;
]]
local clock=os.clock
local startt=clock()
local fs = require("@lune/fs")
local process = require("@lune/process")
local luau = require("@lune/luau")
local targetfilename=process.args[1]
local input = fs.readFile("dumps\\original\\"..targetfilename)
local functionmetatable=setmetatable({},{__index=function()return function()end end})
local print=print
local r={}
local oldbegins={
    "([[This file was protected with MoonSec V3 by Federal#9999]]):gsub",
    "([[This file was protected with MoonSec V3 by federal9999 on discord]]):"
}
local function isOld(src)
    for _, begin in oldbegins do
        if input:sub(1,#begin) == begin then
            return true
        end
    end
end
if isOld(input) then
    table.insert(r,"this is a old version of moonsec and my instruction extraction doesnt really support it. the instructions are gonna be somehwere at the bottom..")
    table.insert(r,"~25ms")
end
local tbl_to_s
function tbl_to_s(tbl, indent)
    indent = indent or 0
    local to_string = function(value)
        if type(value) == "table" then
            return tbl_to_s(value, indent + 2)
        elseif type(value) == "string" then
            return string.format("%q", value)
        else
            return tostring(value)
        end
    end

    local result = "{\n"
    local spacing = string.rep(" ", indent + 2)
    for k, v in pairs(tbl) do
        local key = type(k) == "string" and string.format("%q", k) or "[" .. tostring(k) .. "]"
        result = result .. spacing .. key .. " = " .. to_string(v) .. ",\n"
    end
    result = result .. string.rep(" ", indent) .. "}"
    return result
end
-- local expression="(%a%w?%w?)%[(%a%w?%w?)%]%s*=%s*(%a%w?%w?)[;%s]"
-- if not input:find(expression) then
--     print("couldnt find anything to modify")
--     return
-- end
local runcode = funnydumpsrc..input--:gsub(expression, "_25ms(%3);%1[%2] = %3;")

local chunk, err = luau.load(runcode)
if err then
    warn("BAD OMGG"..err)
    return
end
local cenv = getfenv(chunk)
cenv._25ms = function(var)
    local vartype = type(var)
    if vartype ~= "function" then
        table.insert(r, var)
    end
end
cenv.wait=function()return 1 end
cenv.loadstring=luau.load
cenv.debugresults={}
cenv.getfenv=function(lvl)
    if lvl then
        local res=getfenv(lvl)
        if res.require~=cenv.require then
            return cenv
        end
        return res
    end
    return cenv
end
print(pcall(chunk))

local findah
function findah(t,lvl)
    for i,v in next,t do
        if type(v) == "table" then
            if findah(v,lvl+1) then
                if lvl==1 then
                    return t[i]
                end
                return true
            end
        elseif lvl>2 and type(v)=="string" and (v=="This file was protected with MoonSec V3") then
            return true
        end
    end
end
r=findah(r,1) or r
print(findah(r,1)~=nil)
local result = {}
for _, entry in r do
    local entrytype=type(entry)
    if entrytype == "table" then
        table.insert(result, "[" .. entrytype .. "]:" .. tbl_to_s(entry))
    else
        table.insert(result, "[" .. entrytype .. "]:" .. tostring(entry))
    end
end
if #r==2 and r[2]=="~25ms" then
    return error("none found :(")
end
print(cenv.debugresults)
-- print(table.concat(result,"\n"))
local resultContent=table.concat(result,"\n")
if resultContent=="" then
    print("no results")
    return
end
for i,v in cenv.debugresults do
    v["func"]=nil
end
-- resultContent=[[-- To run on any exec
-- local r=game:GetService("HttpService"):JSONDecode(']]..require("@lune/net").jsonEncode(cenv.debugresults)..[[')
-- local _debug=debug
-- getgenv().debug={}
-- for i,v in next,_debug do debug[i]=v end
-- local gc=1
-- debug.getinfo=function(...)
--     if r[gc] then gc+=1 return r[gc] end
--     return _debug.getinfo(...)
-- end
-- -- dump
-- ]]..resultContent
fs.writeFile("dumps\\dumped\\" .. targetfilename, resultContent)
print("success",clock()-startt)