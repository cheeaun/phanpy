import { createContext } from 'preact';

const FilterContext = createContext<string | undefined>(undefined);
export default FilterContext;
